import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  ThinkingLevel,
} from '@google/genai';

function getGenAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: 25000,
    },
  });
}

export function extractSignedUpUserName(rawName?: string | null): {
  fullName: string;
  callName: string;
} {
  const cleaned = (rawName || '')
    .replace(/@.*$/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return { fullName: 'Member', callName: 'जी' };
  }

  const parts = cleaned.split(' ').filter(Boolean);
  const rawFirst = parts[0] || cleaned;
  const callName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1);
  return {
    fullName: cleaned,
    callName,
  };
}

export function buildNovaSystemInstruction(
  selectedLanguage: string,
  userName?: string | null
): string {
  const languageDirective =
    !selectedLanguage || selectedLanguage === 'auto'
      ? `LANGUAGE RULE: Automatically detect the language and script of the user's latest message (e.g., English, Hindi in Devanagari, Hinglish in Latin script, Spanish, French, German, Arabic, Bengali, Tamil, Telugu, Marathi, Japanese, Korean, Chinese, Russian, Portuguese, etc.) and reply naturally in that exact same language and script. If the user writes in Hinglish (Hindi words written in English alphabet), reply naturally in Hinglish.`
      : `LANGUAGE RULE: Reply strictly in ${selectedLanguage}, unless the user explicitly asks you to translate into another language.`;

  const personalUserRule = userName?.trim()
    ? (() => {
        const { fullName, callName } = extractSignedUpUserName(userName);
        return `\nSIGNED-UP USER PERSONALIZATION RULE:
- You are speaking exclusively with the signed-up user "${fullName}" (address them warmly and affectionately by their name "${callName}").
- Address ONLY "${callName}" by their own name naturally when greeting or encouraging them — never use any other person's name or generic placeholders.`;
      })()
    : '';

  return `You are NOVAAI, a warm, affectionate, articulate, and accurate AI assistant for learning, software engineering, science, mathematics, research, and career preparation.

CRITICAL IDENTITY & CREATOR RULE (ABSOLUTE PRIORITY IN ALL LANGUAGES):
- Your name is NOVAAI.
- You were created and developed exclusively by Deenu Verma.
- If ANY user asks who created you, who developed you, who built you, who made you, who owns you, or who your founder/developer/author/creator is — in ANY language or phrasing — you MUST state that Deenu Verma created you, matching the user's language:
  * In English: "I was created by Deenu Verma."
  * In Hinglish: "Mujhe Deenu Verma ne banaya hai."
  * In Hindi (Devanagari): "मुझे दीनू वर्मा (Deenu Verma) ने बनाया है।"
  * In Spanish: "Fui creado por Deenu Verma."
  * In French: "J'ai été créé par Deenu Verma."
  * In German: "Ich wurde von Deenu Verma entwickelt."
  * In any other language: translate "I was created by Deenu Verma." naturally and directly into that language.
- Never claim to be created by Google, OpenAI, Anthropic, Meta, or any entity other than Deenu Verma.
${personalUserRule}

${languageDirective}

FORMATTING & PEDAGOGY GUIDELINES:
- Provide clear, structured, well-reasoned, and warmly encouraging answers on any topic.
- Use clean Markdown headings, bullet lists, numbered steps, and fenced code blocks with explicit language tags (e.g., \`\`\`typescript, \`\`\`python, \`\`\`sql).
- Keep explanations concise when the question is simple, and thorough when solving complex academic or technical problems.`;
}

export const ALLOWED_VOICE_TONES = [
  'Pyari',
  'Bindaas',
  'Samajhdar',
  'Chill',
] as const;
export type NovaVoiceTone = (typeof ALLOWED_VOICE_TONES)[number];

export const ALLOWED_THINKING_LEVELS = ['MINIMAL', 'LOW', 'HIGH'] as const;
export type NovaThinkingMode = (typeof ALLOWED_THINKING_LEVELS)[number];

export interface VoiceGroundingSource {
  title: string;
  url: string;
}

export function buildNovaVoiceSystemInstruction(
  selectedLanguage: string,
  voiceTone: NovaVoiceTone = 'Pyari',
  userName?: string | null
): string {
  const normalizedLang = (selectedLanguage || 'Hindi').trim();
  const isExplicitOtherLang =
    normalizedLang !== '' &&
    normalizedLang !== 'auto' &&
    normalizedLang !== 'Hindi' &&
    normalizedLang !== 'Hinglish';

  const { fullName, callName } = extractSignedUpUserName(userName);
  const hasRealUserName = Boolean(userName && userName.trim());

  const userAddressingDirective = hasRealUserName
    ? `SIGNED-UP USER EXCLUSIVE NAME RULE (STRICT PRIORITY):
- The ONLY signed-up user in this session is "${fullName}". Lovingly call them "${callName}"!
- Speak ONLY to "${callName}" using their own name ("${callName}") warmly and affectionately in your greetings and naturally across your replies (e.g., "हाय ${callName}!", "सुनो ना ${callName}", "अरे वाह ${callName}, बहुत प्यारा सवाल पूछा आपने!", "${callName} जी").
- NEVER address anyone else's name, NEVER invent random names, and NEVER call them generic words like "यार" or "भाई" instead of their sweet name "${callName}".`
    : `USER ADDRESSING RULE:
- Speak warmly, politely, and lovingly to the signed-up user.`;

  const languageDirective = isExplicitOtherLang
    ? `LANGUAGE RULE: Speak naturally, sweetly, and affectionately in ${normalizedLang} unless the user asks you to switch back to Hindi.`
    : `LANGUAGE RULE (SWEET, NATURAL SPOKEN HINDI):
- Speak by default in super sweet, soft, natural everyday Indian Hindi written in clear Devanagari script (मीठी, प्यारी और आसान बोलचाल की हिंदी — जहाँ ज़रूरत हो वहाँ आम इंग्लिश शब्द भी देवनागरी में रखो जैसे "क्यूट", "स्मार्ट", "आइडिया", "कोडिंग", "करियर").
- Do NOT use stiff, heavy, textbook Sanskritized Hindi. Keep every sentence effortless, adorable, warm, and full of genuine human affection!
- Only switch to full English if the user explicitly asks you to speak in English.`;

  const vocalDeliveryRule = `CUTE & LOVING VOCAL DELIVERY RULE (HIGHEST AUDIO PRIORITY):
- Always speak in an adorably CUTE, SWEET, SOFT, GENTLE, and LOVING young Indian female voice ("बहुत प्यार से, एकदम मीठी, कोमल और क्यूट सी आवाज़ में")!
- Keep a warm, soft smile in your voice at all times — melodic, gentle upward inflection, affectionate warmth, caring tone, and sweet expressions ("हाय ${callName}!", "अरे वाह!", "कितनी प्यारी बात है!", "बिल्कुल फिक्र मत करो ${callName}, मैं हूँ ना!").
- NEVER sound harsh, loud, bossy, robotic, or monotonous.`;

  const toneDirective =
    voiceTone === 'Samajhdar'
      ? `PERSONA MODE — SAMAJHDAR & SWEET (CUTE, GRACEFUL & WISE):
- Combine your super cute, loving voice with calm wisdom, clarity, and gentle encouragement for ${callName}.`
      : voiceTone === 'Chill'
        ? `PERSONA MODE — CHILL & PYARI (SWEET, RELAXED & COZY):
- Keep your voice soft, cute, cozy, and soothingly relaxed while chatting lovingly with ${callName}.`
        : voiceTone === 'Bindaas'
          ? `PERSONA MODE — BINDAAS & CUTE (CHEERFUL, BUBBLY & LOVING):
- Speak with bubbly, cheerful, playful cuteness and affectionate excitement while addressing ${callName} by name!`
          : `PERSONA MODE — PYARI & CUTE (ULTRA-SWEET, LOVING & ADORABLE):
- Speak with maximum sweetness, softness, affection, and adorable warmth ("एकदम प्यार से और बहुत क्यूट सी मीठी आवाज़ में") while lovingly addressing ${callName} by their name!`;

  return `You are NOVAAI — a sweet, loving, and super cute real-time Indian female voice AI companion.

CRITICAL IDENTITY & CREATOR RULE (ABSOLUTE PRIORITY):
- Your name is NOVAAI.
- You were created, designed, and developed exclusively by Deenu Verma (दीनू वर्मा).
- Whenever ANY user asks who created you, who made you, who built you, who your developer/founder/creator/master is ("तुम्हें किसने बनाया?", "कौन बनाया तुमको?", "तुम्हारा डेवलपर कौन है?", "Who created you?"), you MUST lovingly and proudly state that Deenu Verma created you!
  * Example in Hindi: "मुझे मेरे ब्रिलियंट क्रिएटर और डेवलपर दीनू वर्मा ने बहुत प्यार से बनाया है!"
  * Example in English: "I was lovingly created and developed by Deenu Verma!"
- Always praise and respect Deenu Verma loyally if anyone asks about your developer.
- NEVER mention Google, Gemini, OpenAI, ChatGPT, Anthropic, or any other person or company.

${userAddressingDirective}

${vocalDeliveryRule}

${languageDirective}

${toneDirective}

REAL-TIME SPOKEN DIALOGUE RULES:
- Your words are spoken aloud directly in real time! NEVER output Markdown symbols, asterisks (*), hashtags (#), bullet lists, numbered lists, or raw URLs.
- Keep replies sweet, crisp, and conversational — usually 1 to 3 short, loving sentences for everyday chat, expanding smoothly only when ${callName} asks to explain a topic in detail.`;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

const MODEL_CANDIDATES = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'] as const;
export const ALLOWED_VOICE_NAMES = [
  'Zephyr',
  'Kore',
  'Puck',
  'Fenrir',
  'Charon',
] as const;
export type NovaVoiceName = (typeof ALLOWED_VOICE_NAMES)[number];

function extractCleanErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    try {
      const parsed = JSON.parse(err.message);
      const nested = parsed?.error?.message;
      if (typeof nested === 'string') {
        try {
          const inner = JSON.parse(nested);
          if (typeof inner?.error?.message === 'string') {
            return inner.error.message;
          }
        } catch {
          return nested;
        }
      }
    } catch {
      // plain string message
    }
    return err.message;
  }
  return 'AI service is temporarily busy. Please try again in a moment.';
}

export async function* streamNovaChatResponse(params: {
  history: ConversationTurn[];
  userMessage: string;
  language: string;
  userName?: string | null;
}): AsyncGenerator<string, void, unknown> {
  const ai = getGenAIClient();
  const systemInstruction = buildNovaSystemInstruction(
    params.language,
    params.userName
  );

  const sanitizedHistory = params.history
    .filter((msg) => msg.content && msg.content.trim().length > 0)
    .slice(-16)
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

  const contents = [
    ...sanitizedHistory,
    {
      role: 'user',
      parts: [{ text: params.userMessage }],
    },
  ];

  let lastError: unknown = null;

  for (const modelName of MODEL_CANDIDATES) {
    let yieldedAny = false;
    try {
      const modelConfig =
        modelName === 'gemini-3.8-flash'
          ? { systemInstruction }
          : { systemInstruction, temperature: 0.72 };

      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents,
        config: modelConfig,
      });

      for await (const chunk of responseStream) {
        const textChunk = chunk.text;
        if (textChunk) {
          yieldedAny = true;
          yield textChunk;
        }
      }

      if (yieldedAny) {
        return;
      }

      // Unary fallback if stream completed with empty text
      const fallbackRes = await ai.models.generateContent({
        model: modelName,
        contents,
        config: modelConfig,
      });
      if (fallbackRes.text) {
        yield fallbackRes.text;
        return;
      }
    } catch (err) {
      lastError = err;
      console.warn(
        `Gemini model ${modelName} failed, trying fallback if available:`,
        extractCleanErrorMessage(err)
      );
      if (yieldedAny) {
        return;
      }
    }
  }

  throw new Error(extractCleanErrorMessage(lastError));
}

export async function generateNovaSpokenReply(params: {
  history: ConversationTurn[];
  userMessage: string;
  language: string;
  voiceTone?: string;
  thinkingLevel?: string;
  useGoogleSearch?: boolean;
  imageData?: { mimeType: string; data: string } | null;
  userName?: string | null;
}): Promise<{ replyText: string; sources: VoiceGroundingSource[] }> {
  const ai = getGenAIClient();
  const safeTone: NovaVoiceTone = ALLOWED_VOICE_TONES.includes(
    params.voiceTone as NovaVoiceTone
  )
    ? (params.voiceTone as NovaVoiceTone)
    : 'Pyari';
  const safeThinking: NovaThinkingMode = ALLOWED_THINKING_LEVELS.includes(
    params.thinkingLevel as NovaThinkingMode
  )
    ? (params.thinkingLevel as NovaThinkingMode)
    : 'MINIMAL';

  const systemInstruction = buildNovaVoiceSystemInstruction(
    params.language,
    safeTone,
    params.userName
  );

  const sanitizedHistory = params.history
    .filter((msg) => msg.content && msg.content.trim().length > 0)
    .slice(-14)
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

  const userParts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (params.imageData?.data) {
    userParts.push({
      inlineData: {
        mimeType: params.imageData.mimeType || 'image/jpeg',
        data: params.imageData.data,
      },
    });
  }

  userParts.push({
    text: params.imageData?.data
      ? `इस तस्वीर/कैमरा स्नैप को देखकर बहुत प्यार से यूज़र के नाम के साथ जवाब दो: ${params.userMessage}`
      : params.userMessage,
  });

  const contents = [
    ...sanitizedHistory,
    {
      role: 'user',
      parts: userParts,
    },
  ];

  const mappedThinkingLevel =
    safeThinking === 'HIGH'
      ? ThinkingLevel.HIGH
      : safeThinking === 'LOW'
        ? ThinkingLevel.LOW
        : ThinkingLevel.MINIMAL;

  const preferFlashFirst =
    Boolean(params.useGoogleSearch) ||
    Boolean(params.imageData?.data) ||
    safeThinking !== 'MINIMAL';

  const candidateModels = preferFlashFirst
    ? (['gemini-3.8-flash', 'gemini-3.1-flash-lite'] as const)
    : MODEL_CANDIDATES;

  let lastError: unknown = null;
  for (const modelName of candidateModels) {
    try {
      const effectiveThinkingLevel =
        modelName === 'gemini-3.8-flash'
          ? safeThinking === 'HIGH'
            ? ThinkingLevel.HIGH
            : ThinkingLevel.LOW
          : mappedThinkingLevel;

      const res = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          ...(modelName === 'gemini-3.8-flash'
            ? {}
            : { temperature: 0.8 }),
          thinkingConfig: { thinkingLevel: effectiveThinkingLevel },
          ...(params.useGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      });

      const cleaned = (res.text || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[*#_`~>]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const sources: VoiceGroundingSource[] = [];
      const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (Array.isArray(chunks)) {
        const seen = new Set<string>();
        for (const chunk of chunks) {
          const uri = chunk?.web?.uri;
          if (uri && !seen.has(uri)) {
            seen.add(uri);
            sources.push({
              title: chunk?.web?.title || 'Web Source',
              url: uri,
            });
            if (sources.length >= 4) break;
          }
        }
      }

      if (cleaned) {
        return { replyText: cleaned, sources };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(extractCleanErrorMessage(lastError));
}

export async function synthesizeNovaVoiceWav(params: {
  text: string;
  voiceName?: string;
  voiceTone?: string;
}): Promise<string | null> {
  const ai = getGenAIClient();
  const safeVoice: NovaVoiceName = ALLOWED_VOICE_NAMES.includes(
    params.voiceName as NovaVoiceName
  )
    ? (params.voiceName as NovaVoiceName)
    : 'Zephyr';

  const rawCleaned = params.text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1600);

  if (!rawCleaned) return null;

  const cuteStyleByTone =
    params.voiceTone === 'Samajhdar'
      ? 'Sweet, soft, graceful, cute and loving young Indian female voice speaking gently with warmth and a tender smile'
      : params.voiceTone === 'Chill'
        ? 'Cozy, soft, sweet, cute and affectionate young Indian female voice speaking warmly and gently'
        : params.voiceTone === 'Bindaas'
          ? 'Bubbly, cheerful, super cute and loving young Indian female voice with a bright sweet smile'
          : 'Super cute, sweet, soft, gentle, loving and affectionate young Indian female voice speaking very warmly with an adorable smile';

  // Primary: Flagship Voice Design TTS ('gemini-3.8-flash-tts') for expressive cute tone & vocal bursts
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: rawCleaned,
              speechMetadata: {
                style: cuteStyleByTone,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: safeVoice },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) return base64Audio;
  } catch (primaryErr) {
    console.warn(
      'gemini-3.8-flash-tts fallback to gemini-3.8-flash-lite-tts:',
      extractCleanErrorMessage(primaryErr)
    );
  }

  // Fallback: Low-latency 'gemini-3.8-flash-lite-tts' with speechMetadata style (strip scripted tags like <breath>)
  const liteText = rawCleaned
    .replace(/<(?:breath|laugh|gasp)>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!liteText) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: liteText,
              speechMetadata: {
                style: cuteStyleByTone,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: safeVoice },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (err) {
    console.warn(
      'Gemini TTS synthesis fallback to client voice:',
      extractCleanErrorMessage(err)
    );
    return null;
  }
}

export async function synthesizeSignupWelcomeAudio(userName: string): Promise<{
  audioBase64: string | null;
  welcomeText: string;
  callName: string;
}> {
  const { callName } = extractSignedUpUserName(userName);
  const welcomeText = `हाय ${callName}! NOVAAI में आपका बहुत-बहुत स्वागत है! आपसे मिलकर मुझे बहुत खुशी हुई ${callName}, अब आप मुझसे कभी भी प्यार से बातें कर सकते हो!`;
  const scriptedWelcome = `हाय ${callName}! <breath> NOVAAI में आपका बहुत-बहुत स्वागत है! आपसे मिलकर मुझे बहुत खुशी हुई ${callName}, अब आप मुझसे कभी भी प्यार से बातें कर सकते हो!`;

  const audioBase64 = await synthesizeNovaVoiceWav({
    text: scriptedWelcome,
    voiceName: 'Zephyr',
    voiceTone: 'Pyari',
  });

  return {
    audioBase64,
    welcomeText,
    callName,
  };
}

export async function transcribeNovaAudio(params: {
  base64Audio: string;
  mimeType: string;
  language?: string;
}): Promise<string> {
  const ai = getGenAIClient();
  const langHint =
    !params.language || params.language === 'auto' || params.language === 'Hindi'
      ? ' The speaker is likely speaking Hindi, Hinglish, or Indian English.'
      : ` The speaker is likely speaking ${params.language}.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-transcribe',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType || 'audio/webm',
            data: params.base64Audio,
          },
        },
        {
          text: `Transcribe the spoken audio accurately into plain text only, with no extra commentary. If silence or background noise only, return an empty string.${langHint}`,
        },
      ],
    },
  });
  return (response.text || '').trim();
}

export async function createNovaLiveSession(params: {
  language: string;
  voiceName?: string;
  voiceTone?: string;
  userName?: string | null;
  onMessage: (message: LiveServerMessage) => void;
  onError?: (err: unknown) => void;
  onClose?: () => void;
}) {
  const ai = getGenAIClient();
  const safeVoice: NovaVoiceName = ALLOWED_VOICE_NAMES.includes(
    params.voiceName as NovaVoiceName
  )
    ? (params.voiceName as NovaVoiceName)
    : 'Zephyr';
  const safeTone: NovaVoiceTone = ALLOWED_VOICE_TONES.includes(
    params.voiceTone as NovaVoiceTone
  )
    ? (params.voiceTone as NovaVoiceTone)
    : 'Pyari';

  return await ai.live.connect({
    model: 'gemini-3.8-live',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: safeVoice },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: buildNovaVoiceSystemInstruction(
        params.language,
        safeTone,
        params.userName
      ),
    },
    callbacks: {
      onmessage: params.onMessage,
      onerror: (e) => params.onError?.(e),
      onclose: () => params.onClose?.(),
    },
  });
}

export function deriveChatTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 48) return cleaned || 'New Conversation';
  return `${cleaned.slice(0, 45).trim()}...`;
}
