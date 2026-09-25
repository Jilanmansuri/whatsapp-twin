interface ParsedMessage {
  timestamp: Date | null;
  sender: string;
  message: string;
}

interface TrainingPair {
  incoming_message: string;
  reply: string;
  timestamp: Date | null;
  contact_name: string;
}

/**
 * Extracts incoming-reply message pairs from parsed chat history.
 * 
 * @param messages The full sorted list of parsed messages
 * @param targetSenderName The exact sender name of the person the bot should mimic
 * @param maxTimeGapMs Maximum time gap between messages to consider them a conversation pair (default 12 hours)
 */
export function extractTrainingPairs(
  messages: ParsedMessage[],
  targetSenderName: string,
  maxTimeGapMs: number = 12 * 60 * 60 * 1000
): TrainingPair[] {
  // Resolve target sender name using case-insensitive partial match
  const uniqueSenders = Array.from(new Set(messages.map(m => m.sender)));
  const normalizedInput = targetSenderName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  
  let resolvedTargetSender = targetSenderName;
  if (normalizedInput) {
    for (const sender of uniqueSenders) {
      const normalizedSender = sender.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedSender.includes(normalizedInput) || normalizedInput.includes(normalizedSender)) {
        resolvedTargetSender = sender;
        break;
      }
    }
  }
  
  console.log(`[Pair Extractor] Resolved input "${targetSenderName}" to sender "${resolvedTargetSender}"`);
  
  const pairs: TrainingPair[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    
    // If the message is NOT from the target sender (it is an incoming message)
    if (current.sender !== resolvedTargetSender) {
      const incomingText = current.message.trim();
      const incomingSender = current.sender;
      
      // Look forward for the target sender's response
      let replyParts: string[] = [];
      let j = i + 1;
      
      while (j < messages.length) {
        const nextMsg = messages[j];
        
        // If we hit another incoming message (from a contact)
        if (nextMsg.sender !== resolvedTargetSender) {
          // If we already started accumulating target replies, this new incoming message marks the end of this pair
          if (replyParts.length > 0) {
            break;
          }
          // Otherwise, we slide our window forward: this new message becomes the new candidate incoming message
          i = j - 1; // Move outer loop index (i will be incremented to j in next iteration)
          break;
        }
        
        // Verify time gap to make sure they are related
        if (current.timestamp && nextMsg.timestamp) {
          const gap = nextMsg.timestamp.getTime() - current.timestamp.getTime();
          if (gap > maxTimeGapMs) {
            break; // Too much time has passed
          }
        }
        
        replyParts.push(nextMsg.message.trim());
        j++;
      }
      
      if (replyParts.length > 0) {
        const mergedReply = replyParts.join('\n');
        pairs.push({
          incoming_message: incomingText,
          reply: mergedReply,
          timestamp: current.timestamp,
          contact_name: incomingSender,
        });
        
        // Fast-forward outer loop index to the end of the target's replies
        i = j - 1;
      }
    }
  }
  
  return pairs;
}
