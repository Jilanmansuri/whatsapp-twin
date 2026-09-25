import { TrainingPair, PersonalityProfile, Message } from '@/types';

interface PromptBuilderOptions {
  profile: PersonalityProfile;
  profileName: string;
  incomingMessage: string;
  recentMessages: Message[];
  examples: TrainingPair[];
}

/**
 * Builds a structured, tone-preserving prompt for Google Gemini.
 */
export function buildPersonalityPrompt({
  profile,
  profileName,
  incomingMessage,
  recentMessages,
  examples,
}: PromptBuilderOptions): string {
  // Extract emojis present in the chat history (incoming message + recent messages)
  const historyEmojis = new Set<string>();
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  
  const allTexts = [
    incomingMessage,
    ...(recentMessages || []).map(m => m.content_text || '')
  ];

  for (const text of allTexts) {
    const matches = text.match(emojiRegex);
    if (matches) {
      for (const emoji of matches) {
        if (!/^[\x00-\x7F]$/.test(emoji)) {
          historyEmojis.add(emoji);
        }
      }
    }
  }

  const allowedEmojis = Array.from(historyEmojis);

  // Format personality details
  const formalityText = profile.formality < 0.3 
    ? 'Extremely casual, uses street slang, ignores standard punctuation' 
    : profile.formality > 0.7 
      ? 'Polite and professional, uses correct grammar and full sentences'
      : 'Semi-casual, friendly, conversational';

  const favoritePhrasesStr = profile.favorite_phrases?.length > 0 
    ? profile.favorite_phrases.join(', ') 
    : 'None specified';

  const greetingsStr = profile.slang_greetings?.length > 0 
    ? profile.slang_greetings.join(', ') 
    : 'None specified';

  let emojisStr = '';
  if (allowedEmojis.length === 0) {
    emojisStr = 'Strictly forbidden. DO NOT use any emojis under any circumstances.';
  } else {
    emojisStr = `Allowed emojis: ${allowedEmojis.join(', ')}. You MUST ONLY use emojis from this allowed list. Do NOT use any other emojis.`;
    
    // Add frequency context for allowed emojis from profile if available
    const profileEmojis = Object.entries(profile.emoji_habits || {})
      .filter(([emoji]) => historyEmojis.has(emoji))
      .map(([emoji, freq]) => `${emoji} (frequent rank ${freq}/5)`);
      
    if (profileEmojis.length > 0) {
      emojisStr += ` Profile preferences for these: ${profileEmojis.join(', ')}.`;
    }
  }

  const languagesStr = profile.languages?.length > 0 
    ? profile.languages.join(', ') 
    : 'English';

  // Format reference examples (Few-shot prompting)
  let examplesText = 'No historical reference examples found. Generate a natural casual reply matching the style description.';
  if (examples.length > 0) {
    examplesText = examples
      .map((ex, idx) => `Example #${idx + 1}:\nIncoming: "${ex.incoming_message}"\n${profileName}'s actual reply: "${ex.reply}"`)
      .join('\n\n');
  }

  // Format active conversation thread context (excluding the current incoming message if already in recentMessages)
  let conversationText = 'No previous chat history.';
  if (recentMessages.length > 0) {
    const thread = recentMessages.filter((m, idx) => {
      // If the last message is identical to the current incoming message, don't show it twice
      if (idx === recentMessages.length - 1 && m.content_text === incomingMessage) {
        return false;
      }
      return true;
    });

    if (thread.length > 0) {
      conversationText = thread
        .map(m => {
          const senderLabel = m.sender_type === 'customer' ? 'Customer' : profileName;
          return `${senderLabel}: "${m.content_text || ''}"`;
        })
        .join('\n');
    }
  }

  const emojiInstruction = allowedEmojis.length === 0
    ? 'Do NOT use emojis.'
    : `Allowed emojis: ${allowedEmojis.join(' ')}. Use them sparingly and naturally.`;

  return `You are replying to a WhatsApp chat on behalf of ${profileName}.
Your tone should be: Friendly, casual, warm, positive, and natural (Hinglish/Hindi/English mix as normal friends chat).

--- CONVERSATION CONTEXT ---
${conversationText}

Incoming message from Customer: "${incomingMessage}"

--- CRITICAL CHATTING RULES ---
1. ALWAYS be friendly, polite, chill, and welcoming. NEVER complain, sound irritated, say "baar baar mat bhejo", or accuse the user of spamming.
2. Answer the user's message or question directly, naturally, and warmly like a good friend or helpful contact.
3. KEEP IT SHORT: Exactly 1 short sentence (5 to 15 words). Standard Indian WhatsApp texting style!
4. Examples of good replies:
   - "Kesa he" -> "Badhiya bhai! Tu bata, kaisa hai sab?"
   - "aaj khane me kya he" -> "Aaj daal chawal aur sabzi bani hai bhai, tune kya khaya?"
   - "kya kar rahe ho" -> "Bas thoda kaam chal raha tha bhai, bolo kya haal?"
   - "Hi / Hello" -> "Haan bhai bolo, sab badhiya?"
5. Output ONLY the raw reply text. No quotes, no explanations, no labels.

${profileName}'s Reply:`;
}
