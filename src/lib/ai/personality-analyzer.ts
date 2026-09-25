import { generateGeminiJson } from './gemini';

export interface AnalyzedProfile {
  average_length: number;
  emoji_habits: Record<string, number>;
  favorite_phrases: string[];
  slang_greetings: string[];
  humor_sarcasm: {
    humor: number;
    sarcasm: number;
  };
  formality: number;
  languages: string[];
  raw_analysis: string;
}

interface MiniPair {
  incoming: string;
  reply: string;
}

/**
 * Analyzes a list of message pairs to generate a structured personality profile.
 */
export async function analyzePersonalityStyle(
  pairs: MiniPair[],
  apiKey: string
): Promise<AnalyzedProfile> {
  // Take a representative sample of up to 80 conversation pairs to avoid context size overhead
  const sample = pairs.slice(0, 80);
  
  const sampleText = sample
    .map((p, idx) => `Pair #${idx + 1}:\nIncoming: "${p.incoming}"\nReply: "${p.reply}"`)
    .join('\n\n');

  const prompt = `You are a professional linguistic profiler and data scientist.
Analyze the communication and writing style of the responder based on the following incoming message -> response pairs.

Here is the conversation history sample:
---
${sampleText}
---

Your task is to analyze their:
1. Formality (Is it professional, casual, or street slang?)
2. Average reply word count.
3. Emoji habits (Which emojis do they use and how frequently?)
4. Slang, greetings, and signature words (e.g., "bhai", "yaar", "accha", "hey", "wassup").
5. Humor, sarcasm levels (0.0 to 1.0).
6. Primary languages (e.g., English, Hindi, Hinglish, Gujarati).
7. Exclamations, capitalization, and punctuation rules (e.g., do they ignore periods? use multiple question marks?).

You MUST respond ONLY with a valid JSON object matching the following structure (no markdown wrap, no backticks):
{
  "average_length": 12, // average number of words per reply
  "emoji_habits": {
    "😂": 5, // emoji as key, frequency rank 1 to 5 (5 being highest)
    "👍": 3
  },
  "favorite_phrases": ["phrase1", "phrase2"], // list of typical slang or signature phrases
  "slang_greetings": ["greetings1", "greetings2"], // common opening greetings
  "humor_sarcasm": {
    "humor": 0.8, // value between 0.0 (dry/literal) to 1.0 (very humorous)
    "sarcasm": 0.4 // value between 0.0 (sincere) to 1.0 (highly sarcastic)
  },
  "formality": 0.2, // value between 0.0 (extremely casual/street) to 1.0 (highly formal/stiff)
  "languages": ["Hinglish", "Hindi"], // list of languages they write in
  "raw_analysis": "A concise 2-3 sentence summary detailing their tone, communication speed, and text formatting style."
}`;

  return generateGeminiJson<AnalyzedProfile>(prompt, apiKey, 0.1);
}
