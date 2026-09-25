import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { data: settings, error: selectError } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (selectError) {
      console.error('Failed fetching settings:', selectError);
      return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
    }

    // Mask API Key before sending to client for security
    const maskedSettings = settings ? {
      ...settings,
      api_key: settings.api_key ? `${settings.api_key.slice(0, 4)}...${settings.api_key.slice(-4)}` : '',
      has_key: !!settings.api_key
    } : {
      provider: 'gemini',
      api_key: '',
      temperature: 0.7,
      auto_reply_mode: 'off',
      has_key: false
    };

    return NextResponse.json({
      success: true,
      settings: maskedSettings,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('AI Settings GET exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const { provider, api_key, temperature, auto_reply_mode } = await req.json();

    // Retrieve existing settings to avoid overwriting API key if not supplied
    const { data: existing } = await supabase
      .from('ai_settings')
      .select('api_key')
      .eq('user_id', user.id)
      .maybeSingle();

    // Use existing key if no new key is provided
    let finalKey = api_key;
    if (api_key && api_key.includes('...')) {
      finalKey = existing?.api_key || '';
    }

    const { data: upsertedSettings, error: upsertError } = await supabase
      .from('ai_settings')
      .upsert({
        user_id: user.id,
        provider: provider || 'gemini',
        api_key: finalKey,
        temperature: temperature !== undefined ? Number(temperature) : 0.7,
        auto_reply_mode: auto_reply_mode || 'off',
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (upsertError) {
      console.error('Failed saving settings:', upsertError);
      return NextResponse.json({ error: 'Failed to update AI settings' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      settings: {
        ...upsertedSettings,
        api_key: upsertedSettings.api_key ? `${upsertedSettings.api_key.slice(0, 4)}...${upsertedSettings.api_key.slice(-4)}` : '',
        has_key: !!upsertedSettings.api_key
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('AI Settings POST exception:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
