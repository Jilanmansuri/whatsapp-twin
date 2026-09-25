import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { generateAIReply } from '@/lib/ai/reply-engine';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    
    let userId = null;
    let body = await req.json().catch(() => null);
    let supabase;

    if (authHeader && serviceKey && authHeader === `Bearer ${serviceKey}`) {
      if (!body?.user_id) {
        return NextResponse.json({ error: 'user_id required for service role calls' }, { status: 400 });
      }
      userId = body.user_id;
      supabase = createSupabaseClient(supabaseUrl, serviceKey);
    } else {
      supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    }

    const { message, conversation_id } = body || {};

    if (!message) {
      return NextResponse.json({ error: 'Incoming message text is required' }, { status: 400 });
    }

    const result = await generateAIReply(userId, message, conversation_id, supabase);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('AI Generate exception:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate AI reply' },
      { status: 500 }
    );
  }
}
