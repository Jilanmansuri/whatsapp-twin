/**
 * Utility to communicate with the Google Gemini API using native fetch.
 */

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
    status: string;
  };
}

/**
 * Generates text using the Gemini 1.5 Flash model.
 */
export async function generateGeminiText(
  prompt: string,
  apiKey: string,
  temperature: number = 0.7
): Promise<string> {
  if (!apiKey) {
    throw new Error('Google Gemini API Key is missing. Add it in AI Settings.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `HTTP error ${res.status}`);
    }

    const data: GeminiResponse = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error(data.error?.message || 'Empty response received from Gemini API');
    }

    return text.trim();
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Gemini API call failed:', error);
    throw error;
  }
}

/**
 * Generates structured JSON output using the Gemini 1.5 Flash model.
 */
export async function generateGeminiJson<T>(
  prompt: string,
  apiKey: string,
  temperature: number = 0.2
): Promise<T> {
  if (!apiKey) {
    throw new Error('Google Gemini API Key is missing. Add it in AI Settings.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error?.message || `HTTP error ${res.status}`);
    }

    const data: GeminiResponse = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error(data.error?.message || 'Empty response received from Gemini API');
    }

    return JSON.parse(text) as T;
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Gemini JSON API call failed:', error);
    throw error;
  }
}
