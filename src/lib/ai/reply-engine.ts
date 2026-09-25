import { createClient } from '@/lib/supabase/server';
import { buildPersonalityPrompt } from './prompt-builder';
import { generateGeminiText } from './gemini';
import { TrainingPair, Message } from '@/types';

interface ReplyEngineResult {
  reply: string;
  latencyMs: number;
  confidence: number;
  retrievedMemories: string[];
}

/**
 * Orchestrates the full process of generating a tone-matched reply using Gemini.
 */
export async function generateAIReply(
  userId: string,
  incomingMessage: string,
  conversationId?: string | null,
  supabaseClient?: any
): Promise<ReplyEngineResult> {
  const startTime = Date.now();
  const supabase = supabaseClient || await createClient();

  // 1. Fetch AI Settings
  const { data: settings, error: settingsErr } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const apiKey = settings?.api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('AI Settings or Google Gemini API Key is missing. Please configure it in Settings or .env.local.');
  }

  // Resolve contact's name for this conversation to support contact-specific style customization
  let contactName: string | null = null;
  if (conversationId) {
    const { data: convo } = await supabase
      .from('conversations')
      .select('contact:contacts(name)')
      .eq('id', conversationId)
      .maybeSingle();
    if (convo && convo.contact) {
      contactName = convo.contact.name;
    }
  }

  // 2. Fetch Personality Profile (matching contact specific first, fallback to general)
  let profile = null;
  let profileErr = null;

  if (contactName) {
    const { data: contactProfile, error: cErr } = await supabase
      .from('personality_profiles')
      .select('*')
      .eq('user_id', userId)
      .ilike('contact_name', contactName)
      .maybeSingle();
    profile = contactProfile;
    profileErr = cErr;
  }

  if (!profile) {
    const { data: generalProfile, error: gErr } = await supabase
      .from('personality_profiles')
      .select('*')
      .eq('user_id', userId)
      .is('contact_name', null)
      .maybeSingle();
    profile = generalProfile;
    if (gErr) profileErr = gErr;
  }

  if (!profile) {
    // Default fallback personality so Gemini can respond immediately even without a chat export
    profile = {
      id: 'default',
      user_id: userId,
      contact_name: null,
      average_length: 12,
      emoji_habits: {},
      favorite_phrases: [],
      slang_greetings: ['Hi', 'Haan bhai', 'Hello'],
      humor_sarcasm: {},
      formality: 0.4,
      languages: ['Hinglish', 'Hindi', 'English'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // Get user profile full name for naming references in the prompt
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', userId)
    .maybeSingle();
  
  const profileName = userProfile?.full_name || 'User';

  // 3. Fetch similar history references (filtered by contact name if matching pairs exist, fallback to general pairs)
  let useContactFilter = false;
  if (contactName) {
    const { count } = await supabase
      .from('training_pairs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .ilike('contact_name', contactName);
    useContactFilter = (count || 0) > 0;
  }

  const words = incomingMessage
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, '') // Keep alpha-numeric and Hindi chars
    .split(/\s+/)
    .filter(w => w.length > 3);

  let examples: TrainingPair[] = [];

  if (words.length > 0) {
    let query = supabase
      .from('training_pairs')
      .select('*')
      .eq('user_id', userId);

    if (useContactFilter && contactName) {
      query = query.ilike('contact_name', contactName);
    } else {
      query = query.is('contact_name', null);
    }

    // Build a comma-separated OR query for Supabase client
    const orCondition = words.map(w => `incoming_message.ilike.%${w}%`).join(',');
    const { data: matched } = await query.or(orCondition).limit(4);

    if (matched && matched.length > 0) {
      examples = matched;
    }
  }

  // Fallback if keyword search yielded no matches
  if (examples.length === 0) {
    let query = supabase
      .from('training_pairs')
      .select('*')
      .eq('user_id', userId);

    if (useContactFilter && contactName) {
      query = query.ilike('contact_name', contactName);
    } else {
      query = query.is('contact_name', null);
    }

    const { data: general } = await query.limit(3);

    // If still no general training pairs, fallback to any training pairs
    if (!general || general.length === 0) {
      const { data: fallbackPairs } = await supabase
        .from('training_pairs')
        .select('*')
        .eq('user_id', userId)
        .limit(3);
      if (fallbackPairs) {
        examples = fallbackPairs;
      }
    } else {
      examples = general;
    }
  }

  // 4. Fetch recent conversation context (if thread exists)
  let recentMessages: Message[] = [];
  if (conversationId) {
    const { data: chatHistory } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (chatHistory) {
      // Reverse history list to read chronologically
      recentMessages = chatHistory.reverse();
    }
  }

  // 5. Compile Prompt
  const prompt = buildPersonalityPrompt({
    profile,
    profileName,
    incomingMessage,
    recentMessages,
    examples,
  });

  // 6. Generate Response from Gemini
  const reply = await generateGeminiText(prompt, apiKey, Number(settings?.temperature) || 0.7);

  const latencyMs = Date.now() - startTime;
  
  // Simple heuristic for confidence level (based on keyword examples retrieved)
  const confidence = examples.length > 0 ? 0.85 : 0.65;
  const retrievedMemories = examples.map(ex => `[In]: ${ex.incoming_message} -> [Out]: ${ex.reply}`);

  // 7. Async log transaction to reply_logs for Dashboard Analytics
  try {
    await supabase.from('reply_logs').insert({
      user_id: userId,
      conversation_id: conversationId || null,
      prompt_length: prompt.length,
      retrieved_memories: retrievedMemories,
      reply_text: reply,
      latency_ms: latencyMs,
      confidence,
      model: 'gemini-3.1-flash-lite',
    });
  } catch (logErr) {
    console.error('Failed writing reply logs:', logErr);
  }

  return {
    reply,
    latencyMs,
    confidence,
    retrievedMemories,
  };
}
