import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseWhatsAppChat } from '@/lib/ai/chat-parser';
import { extractTrainingPairs } from '@/lib/ai/pair-extractor';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const targetSender = formData.get('target_sender') as string | null;
    const contactNameOverride = formData.get('contact_name') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!targetSender) {
      return NextResponse.json({ error: 'Target sender name is required' }, { status: 400 });
    }

    const fileContent = await file.text();

    // 1. Create a training upload log row in the database
    const { data: upload, error: uploadError } = await supabase
      .from('training_uploads')
      .insert({
        user_id: user.id,
        filename: file.name,
        file_size: file.size,
        status: 'parsing',
      })
      .select()
      .single();

    if (uploadError || !upload) {
      console.error('Failed to create upload record:', uploadError);
      return NextResponse.json({ error: 'Failed to initialize parser transaction' }, { status: 500 });
    }

    // 2. Parse raw WhatsApp chat file content
    const parsedMessages = parseWhatsAppChat(fileContent);
    if (parsedMessages.length === 0) {
      await supabase
        .from('training_uploads')
        .update({
          status: 'failed',
          error_message: 'No valid messages found in file. Ensure file follows standard WhatsApp export format.',
        })
        .eq('id', upload.id);

      return NextResponse.json(
        { error: 'No valid messages found. Check file format.' },
        { status: 400 }
      );
    }

    // 3. Extract training pairs (incoming message -> user reply)
    const trainingPairs = extractTrainingPairs(parsedMessages, targetSender);

    if (trainingPairs.length === 0) {
      await supabase
        .from('training_uploads')
        .update({
          status: 'failed',
          error_message: `No reply pairs found. Verify that the exact sender name "${targetSender}" exists in the chat.`,
        })
        .eq('id', upload.id);

      return NextResponse.json(
        { error: `No message pairs found where "${targetSender}" replied to another person.` },
        { status: 400 }
      );
    }

    // 4. Save training pairs in bulk using chunked inserts to keep DB calls fast and avoid payload limit errors
    const chunkSize = 200;
    const dbPairs = trainingPairs.map(p => ({
      upload_id: upload.id,
      user_id: user.id,
      incoming_message: p.incoming_message,
      reply: p.reply,
      timestamp: p.timestamp ? p.timestamp.toISOString() : null,
      contact_name: (contactNameOverride && contactNameOverride.trim()) || p.contact_name,
    }));

    for (let i = 0; i < dbPairs.length; i += chunkSize) {
      const chunk = dbPairs.slice(i, i + chunkSize);
      const { error: insertError } = await supabase
        .from('training_pairs')
        .insert(chunk);

      if (insertError) {
        console.error('Failed inserting pairs chunk:', insertError);
        await supabase
          .from('training_uploads')
          .update({
            status: 'failed',
            error_message: `Database insertion error: ${insertError.message}`,
          })
          .eq('id', upload.id);

        return NextResponse.json({ error: 'Failed to write parsed data to database' }, { status: 500 });
      }
    }

    // 5. Update status of the upload transaction to parsed and count the rows
    const { data: updatedUpload, error: updateError } = await supabase
      .from('training_uploads')
      .update({
        status: 'parsed',
        parsed_pairs_count: dbPairs.length,
      })
      .eq('id', upload.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update upload status:', updateError);
    }

    return NextResponse.json({
      success: true,
      upload: updatedUpload || upload,
      pairsCount: dbPairs.length,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Upload handler exception:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: uploads, error: selectError } = await supabase
      .from('training_uploads')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (selectError) {
      console.error('Failed to query uploads:', selectError);
      return NextResponse.json({ error: 'Failed to fetch uploads list' }, { status: 500 });
    }

    return NextResponse.json({ success: true, uploads });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Upload GET handler exception:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

