import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { analyzePersonalityStyle } from '@/lib/ai/personality-analyzer';

export async function GET(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const list = url.searchParams.get('list') === 'true';
    const contactName = url.searchParams.get('contact_name');

    if (list) {
      const { data: profiles, error: selectError } = await supabase
        .from('personality_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('contact_name', { nullsFirst: true });

      if (selectError) {
        console.error('Failed fetching personality profiles list:', selectError);
        return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        profiles,
      });
    }

    let query = supabase
      .from('personality_profiles')
      .select('*')
      .eq('user_id', user.id);

    if (contactName) {
      query = query.eq('contact_name', contactName);
    } else {
      query = query.is('contact_name', null);
    }

    const { data: profile, error: selectError } = await query.maybeSingle();

    if (selectError) {
      console.error('Failed fetching personality profile:', selectError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Personality profile GET exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    // 1. Fetch AI Settings to get Gemini API key
    const { data: settings } = await supabase
      .from('ai_settings')
      .select('api_key')
      .eq('user_id', userId)
      .maybeSingle();

    const apiKey = settings?.api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI Settings or Gemini API Key is missing. Add it in Settings or .env.local.' },
        { status: 400 }
      );
    }

    // 2. Query training pairs to feed into analyzer
    let query = supabase
      .from('training_pairs')
      .select('incoming_message, reply, contact_name')
      .eq('user_id', userId);

    if (body?.upload_id) {
      query = query.eq('upload_id', body.upload_id);
    } else if (body?.contact_name) {
      query = query.eq('contact_name', body.contact_name);
    }

    const { data: pairs, error: pairsError } = await query.order('created_at', { ascending: false });

    if (pairsError) {
      console.error('Failed fetching pairs for analysis:', pairsError);
      return NextResponse.json({ error: 'Failed retrieving dataset' }, { status: 500 });
    }

    if (!pairs || pairs.length === 0) {
      return NextResponse.json(
        { error: 'No training data found. Please upload a chat export file first.' },
        { status: 400 }
      );
    }

    // Map database pairs into mini-pair structure
    const miniPairs = pairs.map(p => ({
      incoming: p.incoming_message,
      reply: p.reply,
    }));

    // 3. Analyze personality style via Gemini
    const analysis = await analyzePersonalityStyle(miniPairs, apiKey);

    // 4. Upsert the generated profile
    let resolvedContactName = body?.contact_name || null;
    if (!resolvedContactName && body?.upload_id) {
      if (pairs && pairs.length > 0) {
        resolvedContactName = pairs[0].contact_name;
      }
    }

    const upsertPayload: any = {
      user_id: userId,
      average_length: analysis.average_length,
      emoji_habits: analysis.emoji_habits,
      favorite_phrases: analysis.favorite_phrases,
      slang_greetings: analysis.slang_greetings,
      humor_sarcasm: analysis.humor_sarcasm,
      formality: analysis.formality,
      languages: analysis.languages,
      raw_analysis: analysis.raw_analysis,
    };

    if (resolvedContactName) {
      upsertPayload.contact_name = resolvedContactName;
    }

    const { data: upsertedProfile, error: upsertError } = await supabase
      .from('personality_profiles')
      .upsert(upsertPayload, { onConflict: 'user_id, contact_name' })
      .select()
      .single();

    if (upsertError) {
      console.error('Failed upserting profile:', upsertError);
      return NextResponse.json({ error: 'Failed saving personality analysis' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: upsertedProfile,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Personality profile POST exception:', error);
    return NextResponse.json(
      { error: error.message || 'Linguistic analysis failed' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const updateFields: any = {
      user_id: user.id,
      updated_at: new Date().toISOString()
    };

    if (body.contact_name !== undefined) {
      updateFields.contact_name = body.contact_name || null;
    }

    if (body.emoji_habits !== undefined) {
      if (typeof body.emoji_habits !== 'object') {
        return NextResponse.json({ error: 'emoji_habits must be an object' }, { status: 400 });
      }
      updateFields.emoji_habits = body.emoji_habits;
    }

    if (body.slang_greetings !== undefined) {
      if (!Array.isArray(body.slang_greetings)) {
        return NextResponse.json({ error: 'slang_greetings must be an array' }, { status: 400 });
      }
      updateFields.slang_greetings = body.slang_greetings;
    }

    if (body.favorite_phrases !== undefined) {
      if (!Array.isArray(body.favorite_phrases)) {
        return NextResponse.json({ error: 'favorite_phrases must be an array' }, { status: 400 });
      }
      updateFields.favorite_phrases = body.favorite_phrases;
    }

    if (body.languages !== undefined) {
      if (!Array.isArray(body.languages)) {
        return NextResponse.json({ error: 'languages must be an array' }, { status: 400 });
      }
      updateFields.languages = body.languages;
    }

    if (body.raw_analysis !== undefined) {
      if (typeof body.raw_analysis !== 'string') {
        return NextResponse.json({ error: 'raw_analysis must be a string' }, { status: 400 });
      }
      updateFields.raw_analysis = body.raw_analysis;
    }

    // Upsert the profile with new settings
    const { data: updatedProfile, error: upsertError } = await supabase
      .from('personality_profiles')
      .upsert(updateFields, { onConflict: 'user_id, contact_name' })
      .select()
      .single();

    if (upsertError) {
      console.error('Failed to update personality settings:', upsertError);
      return NextResponse.json({ error: 'Failed to save personality settings' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Personality profile PUT exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

