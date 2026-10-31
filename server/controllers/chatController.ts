import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createChatRecord,
  deleteUserChat,
  getChatWithMessages,
  insertChatMessage,
  listUserChats,
} from '../../src/db/repositories.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/errorHandler.ts';
import {
  deriveChatTitle,
  generateNovaSpokenReply,
  streamNovaChatResponse,
  synthesizeNovaVoiceWav,
  synthesizeSignupWelcomeAudio,
  transcribeNovaAudio,
  type ConversationTurn,
} from '../services/geminiService.ts';
import { chatRequestSchema } from '../validators/schemas.ts';

export async function streamChatHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = chatRequestSchema.parse(req.body);
    const userId = req.user?.uid ?? null;

    let activeChatId: number | null = userId ? (parsed.chatId ?? null) : null;
    let chatTitle = deriveChatTitle(parsed.message);
    let history: ConversationTurn[] = [];
    let savedUserMsgId = Date.now();

    if (userId) {
      if (activeChatId) {
        const existing = await getChatWithMessages(activeChatId, userId);
        if (existing) {
          chatTitle = existing.title;
          history = existing.messages.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          }));
        } else {
          // If client held a stale chatId, start a fresh chat seamlessly
          const created = await createChatRecord(userId, chatTitle);
          activeChatId = created.id;
        }
      } else {
        const created = await createChatRecord(userId, chatTitle);
        activeChatId = created.id;
      }

      const savedUserMsg = await insertChatMessage({
        chatId: activeChatId,
        role: 'user',
        content: parsed.message,
        language: parsed.language || 'auto',
      });
      savedUserMsgId = savedUserMsg.id;
    } else if (parsed.history && parsed.history.length > 0) {
      history = parsed.history.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }

    // Disable Nagle algorithm & establish unbuffered SSE headers
    req.socket?.setNoDelay?.(true);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    const sendEvent = (event: string, payload: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    sendEvent('meta', {
      chatId: activeChatId ?? 0,
      title: chatTitle,
      userMessageId: savedUserMsgId,
    });

    let fullAssistantReply = '';

    try {
      const generator = streamNovaChatResponse({
        history,
        userMessage: parsed.message,
        language: parsed.language || 'auto',
        userName: req.user?.name ?? null,
      });

      for await (const delta of generator) {
        fullAssistantReply += delta;
        sendEvent('token', { text: delta });
      }

      if (!fullAssistantReply.trim()) {
        fullAssistantReply =
          'I could not generate a response for that prompt. Please try rephrasing your question.';
        sendEvent('token', { text: fullAssistantReply });
      }

      if (userId && activeChatId) {
        const savedAssistantMsg = await insertChatMessage({
          chatId: activeChatId,
          role: 'assistant',
          content: fullAssistantReply,
          language: parsed.language || 'auto',
        });

        sendEvent('done', {
          chatId: activeChatId,
          title: chatTitle,
          message: savedAssistantMsg,
        });
      } else {
        sendEvent('done', {
          chatId: 0,
          title: chatTitle,
          message: {
            id: `guest-ai-${Date.now()}`,
            chatId: 0,
            role: 'assistant',
            content: fullAssistantReply,
            language: parsed.language || 'auto',
            createdAt: new Date().toISOString(),
          },
        });
      }

      res.end();
    } catch (streamError) {
      console.error('Gemini SSE streaming error:', streamError);
      const errorMessage =
        streamError instanceof Error && streamError.message
          ? streamError.message
          : 'Failed to generate AI response.';
      sendEvent('error', { error: errorMessage });
      res.end();
    }
  } catch (err) {
    next(err);
  }
}

export async function listChatsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
    const result = await listUserChats(req.user.uid, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getChatHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const chatId = Number(req.params.id);
    if (!Number.isInteger(chatId) || chatId <= 0) {
      throw new HttpError(400, 'Invalid chat ID.');
    }
    const chat = await getChatWithMessages(chatId, req.user.uid);
    if (!chat) {
      throw new HttpError(404, 'Chat not found.');
    }
    res.json({ chat });
  } catch (err) {
    next(err);
  }
}

const voiceConverseSchema = z.object({
  chatId: z.number().int().positive().nullable().optional(),
  message: z.string().trim().min(1).max(4000),
  language: z.string().trim().max(40).optional(),
  voiceName: z.string().trim().max(30).optional(),
  voiceTone: z.enum(['Pyari', 'Bindaas', 'Samajhdar', 'Chill']).optional(),
  thinkingLevel: z.enum(['MINIMAL', 'LOW', 'HIGH']).optional(),
  useGoogleSearch: z.boolean().optional(),
  imageData: z
    .object({
      mimeType: z.string().trim().max(80),
      data: z.string().min(10),
    })
    .nullable()
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
});

const voiceTranscribeSchema = z.object({
  base64Audio: z.string().min(10),
  mimeType: z.string().trim().max(80).optional(),
  language: z.string().trim().max(40).optional(),
});

export async function voiceConverseHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const parsed = voiceConverseSchema.parse(req.body);
    const userId = req.user.uid;
    const language = parsed.language || 'Hindi';

    let activeChatId: number | null = parsed.chatId ?? null;
    let chatTitle = deriveChatTitle(parsed.message);
    let history: ConversationTurn[] = [];

    if (activeChatId) {
      const existing = await getChatWithMessages(activeChatId, userId);
      if (existing) {
        chatTitle = existing.title;
        history = existing.messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));
      } else {
        const created = await createChatRecord(userId, chatTitle);
        activeChatId = created.id;
      }
    } else {
      const created = await createChatRecord(userId, chatTitle);
      activeChatId = created.id;
    }

    const savedUserMsg = await insertChatMessage({
      chatId: activeChatId,
      role: 'user',
      content: parsed.message,
      language,
    });

    const { replyText: spokenReply, sources } = await generateNovaSpokenReply({
      history,
      userMessage: parsed.message,
      language,
      voiceTone: parsed.voiceTone || 'Pyari',
      thinkingLevel: parsed.thinkingLevel,
      useGoogleSearch: parsed.useGoogleSearch,
      imageData: parsed.imageData ?? null,
      userName: req.user.name,
    });

    const [savedAssistantMsg, audioWavBase64] = await Promise.all([
      insertChatMessage({
        chatId: activeChatId,
        role: 'assistant',
        content: spokenReply,
        language,
      }),
      synthesizeNovaVoiceWav({
        text: spokenReply,
        voiceName: parsed.voiceName || 'Zephyr',
        voiceTone: parsed.voiceTone || 'Pyari',
      }),
    ]);

    res.json({
      chatId: activeChatId,
      title: chatTitle,
      userMessage: savedUserMsg,
      assistantMessage: savedAssistantMsg,
      replyText: spokenReply,
      audioWavBase64,
      sources,
    });
  } catch (err) {
    next(err);
  }
}

export async function voiceTranscribeHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const parsed = voiceTranscribeSchema.parse(req.body);
    const transcript = await transcribeNovaAudio({
      base64Audio: parsed.base64Audio,
      mimeType: parsed.mimeType || 'audio/webm',
      language: parsed.language,
    });
    res.json({ transcript });
  } catch (err) {
    next(err);
  }
}

const voiceTtsSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  voiceName: z.string().trim().max(30).optional(),
  voiceTone: z.enum(['Pyari', 'Bindaas', 'Samajhdar', 'Chill']).optional(),
});

export async function voiceTtsHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const parsed = voiceTtsSchema.parse(req.body);
    const audioBase64 = await synthesizeNovaVoiceWav({
      text: parsed.text,
      voiceName: parsed.voiceName || 'Zephyr',
      voiceTone: parsed.voiceTone || 'Pyari',
    });
    res.json({ audioBase64 });
  } catch (err) {
    next(err);
  }
}

export async function welcomeVoiceHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const result = await synthesizeSignupWelcomeAudio(req.user.name);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteChatHandler(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required.');
    const chatId = Number(req.params.id);
    if (!Number.isInteger(chatId) || chatId <= 0) {
      throw new HttpError(400, 'Invalid chat ID.');
    }
    const deleted = await deleteUserChat(chatId, req.user.uid);
    if (!deleted) {
      throw new HttpError(404, 'Chat not found.');
    }
    res.json({ success: true, id: chatId });
  } catch (err) {
    next(err);
  }
}
