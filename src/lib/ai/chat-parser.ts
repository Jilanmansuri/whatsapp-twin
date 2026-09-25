interface ParsedMessage {
  timestamp: Date | null;
  sender: string;
  message: string;
}

/**
 * Parses raw WhatsApp chat export .txt content into structured message objects.
 */
export function parseWhatsAppChat(fileContent: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const lines = fileContent.split(/\r?\n/);

  // Regex patterns to match timestamp and sender
  // 1. Android format: "dd/mm/yy, hh:mm - Sender: Message" or "d/m/yy, h:mm AM/PM - Sender: Message"
  const androidRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM|am|pm)?)\s?-\s?([^:]+):\s(.*)$/;

  // 2. iOS format: "[dd/mm/yy, hh:mm:ss] Sender: Message" or "[d/m/yy, h:mm:ss AM/PM] Sender: Message"
  const iosRegex = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM|am|pm)?)\]\s([^:]+):\s(.*)$/;

  let currentMsg: ParsedMessage | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    let match = line.match(androidRegex);
    let isIos = false;

    if (!match) {
      match = line.match(iosRegex);
      if (match) isIos = true;
    }

    if (match) {
      // Save current message before starting a new one
      if (currentMsg) {
        messages.push(currentMsg);
      }

      const dateStr = match[1];
      const timeStr = match[2];
      const sender = match[3].trim();
      const message = match[4].trim();

      // Parse timestamp
      let timestamp: Date | null = null;
      try {
        // Simple heuristic parsing of WhatsApp timestamps
        // "dd/mm/yy" or "dd/mm/yyyy"
        const parts = dateStr.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed month
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000; // Handle 2-digit years

        // "hh:mm" or "hh:mm:ss" and optional AM/PM
        const isPM = /pm|PM/.test(timeStr);
        const cleanTime = timeStr.replace(/(?:AM|PM|am|pm)/g, '').trim();
        const timeParts = cleanTime.split(':');
        let hour = parseInt(timeParts[0], 10);
        const minute = parseInt(timeParts[1], 10);
        const second = timeParts[2] ? parseInt(timeParts[2], 10) : 0;

        if (isPM && hour < 12) hour += 12;
        if (!isPM && hour === 12) hour = 0; // Midnight 12 AM is 0 hours

        timestamp = new Date(year, month, day, hour, minute, second);
        if (isNaN(timestamp.getTime())) {
          timestamp = null;
        }
      } catch (err) {
        // Fallback to null on parsing error
        timestamp = null;
      }

      currentMsg = {
        timestamp,
        sender,
        message,
      };
    } else {
      // It's a multiline message extension of the previous message
      if (currentMsg) {
        currentMsg.message += '\n' + line.trim();
      }
    }
  }

  // Push the final message
  if (currentMsg) {
    messages.push(currentMsg);
  }

  // Filter messages to remove system notifications and omitted media
  return messages.filter((msg) => {
    const text = msg.message.toLowerCase();
    
    // Ignore end-to-end encryption notifications
    if (text.includes('end-to-end encrypted') || text.includes('messages and calls are encrypted')) {
      return false;
    }
    // Ignore media omitted messages
    if (text.includes('<media omitted>') || text.includes('[media omitted]') || text.includes('‎image omitted') || text.includes('‎video omitted')) {
      return false;
    }
    // Ignore missed calls
    if (text.includes('missed voice call') || text.includes('missed video call') || text.includes('missed call')) {
      return false;
    }
    // Ignore message deleted notices
    if (text.includes('this message was deleted') || text.includes('you deleted this message')) {
      return false;
    }
    // Ignore system group updates
    if (
      text.includes('created group') ||
      text.includes('changed the subject') ||
      text.includes('added you') ||
      text.includes('changed this group') ||
      text.includes('joined using') ||
      text.includes('left the group')
    ) {
      return false;
    }

    return true;
  });
}
