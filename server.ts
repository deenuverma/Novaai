import fs from 'node:fs';
import http, { type IncomingMessage } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type { Express } from 'express';
import { WebSocketServer, type RawData, type WebSocket as WsSocket } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildExpressAndViteApp(
  server: http.Server,
  isProduction: boolean,
  distPath: string,
  distIndex: string
): Promise<Express> {
  const [{ default: express }, { createApiApp }, { errorHandler }, { warmDatabasePool }] =
    await Promise.all([
      import('express'),
      import('./server/app.ts'),
      import('./server/middleware/errorHandler.ts'),
      import('./src/db/index.ts'),
    ]);

  // Warm Cloud SQL pool asynchronously in background without blocking HTTP startup
  void warmDatabasePool();
  const warmTimer = setInterval(() => {
    void warmDatabasePool();
  }, 240_000);
  warmTimer.unref?.();

  const app = createApiApp();

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(distIndex);
    });
  }

  app.use(errorHandler);
  return app;
}

async function startServer() {
  const port = Number(process.env.PORT) || 3000;
  const distPath = path.resolve(__dirname, 'dist');
  const distIndex = path.join(distPath, 'index.html');

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (process.env.npm_lifecycle_event === 'start' && fs.existsSync(distIndex));

  let resolvedApp: Express | null = null;
  let appInitError: unknown = null;
  let appReadyPromise: Promise<Express> | null = null;

  const server = http.createServer(async (req, res) => {
    // Instant lightweight health check even during cold-boot initialization
    if (req.url === '/__health' || (req.url === '/api/health' && !resolvedApp)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', ready: Boolean(resolvedApp) }));
      return;
    }

    if (resolvedApp) {
      resolvedApp(req, res);
      return;
    }

    try {
      const app = await appReadyPromise!;
      app(req, res);
    } catch (err) {
      console.error('Server initialization error:', appInitError || err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Server failed to initialize.');
      }
    }
  });

  // Start initializing Express + Vite immediately while binding port 3000 in <100ms
  appReadyPromise = buildExpressAndViteApp(
    server,
    isProduction,
    distPath,
    distIndex
  )
    .then((app) => {
      resolvedApp = app;
      return app;
    })
    .catch((err) => {
      appInitError = err;
      console.error('Failed to initialize Express/Vite stack:', err);
      throw err;
    });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const reqUrl = new URL(
        request.url || '/',
        `http://${request.headers.host || 'localhost'}`
      );
      if (reqUrl.pathname !== '/api/live') {
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, reqUrl);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on(
    'connection',
    async (clientWs: WsSocket, _request: IncomingMessage, reqUrl: URL) => {
      try {
        await appReadyPromise;
        const [
          { resolveTokenToUser },
          { REFRESH_COOKIE_NAME, verifyRefreshToken },
          {
            createNovaLiveSession,
            deriveChatTitle,
            extractSignedUpUserName,
          },
          { createChatRecord, findUserByUid, insertChatMessage },
        ] = await Promise.all([
          import('./server/middleware/auth.ts'),
          import('./server/lib/jwt.ts'),
          import('./server/services/geminiService.ts'),
          import('./src/db/repositories.ts'),
        ]);

        const token = reqUrl.searchParams.get('token') || '';
        const language = reqUrl.searchParams.get('language') || 'Hindi';
        const voiceTone = reqUrl.searchParams.get('tone') || 'Pyari';
        const voiceName = reqUrl.searchParams.get('voice') || 'Zephyr';
        const initialChatId =
          Number(reqUrl.searchParams.get('chatId') || '0') || null;

        let authedUser: Awaited<ReturnType<typeof resolveTokenToUser>> = null;
        try {
          authedUser = token ? await resolveTokenToUser(token) : null;
        } catch {
          authedUser = null;
        }

        if (!authedUser && _request.headers.cookie) {
          try {
            const cookieMap = Object.fromEntries(
              _request.headers.cookie.split(';').map((part) => {
                const idx = part.indexOf('=');
                if (idx === -1) return [part.trim(), ''];
                return [
                  part.slice(0, idx).trim(),
                  decodeURIComponent(part.slice(idx + 1).trim()),
                ];
              })
            );
            const rt = cookieMap[REFRESH_COOKIE_NAME];
            if (rt) {
              const decoded = verifyRefreshToken(rt);
              if (decoded?.uid) {
                const dbUser = await findUserByUid(decoded.uid).catch(
                  () => null
                );
                if (dbUser) {
                  authedUser = {
                    id: dbUser.id,
                    uid: dbUser.uid,
                    name: dbUser.name,
                    email: dbUser.email,
                    avatar: dbUser.avatar,
                    googleId: dbUser.googleId,
                    hasPassword: Boolean(dbUser.passwordHash),
                    isAdmin: dbUser.email.trim().toLowerCase() === 'deenuverma238@gmail.com',
                    createdAt: dbUser.createdAt,
                  };
                }
              }
            }
          } catch {
            authedUser = null;
          }
        }

        if (!authedUser) {
          clientWs.send(
            JSON.stringify({ type: 'error', error: 'Authentication required.' })
          );
          clientWs.close();
          return;
        }

        let activeChatId: number | null = initialChatId;
        let userTranscriptBuffer = '';
        let aiTranscriptBuffer = '';

        const flushTurnToDb = async () => {
          const uText = userTranscriptBuffer.trim();
          const aText = aiTranscriptBuffer.trim();
          userTranscriptBuffer = '';
          aiTranscriptBuffer = '';
          if (!uText && !aText) return;
          try {
            if (!activeChatId) {
              const title = deriveChatTitle(
                uText || aText || 'Live Voice Session'
              );
              const created = await createChatRecord(authedUser!.uid, title);
              activeChatId = created.id;
              if (clientWs.readyState === clientWs.OPEN) {
                clientWs.send(
                  JSON.stringify({
                    type: 'chat_meta',
                    chatId: created.id,
                    title,
                  })
                );
              }
            }
            if (uText) {
              const savedU = await insertChatMessage({
                chatId: activeChatId,
                role: 'user',
                content: uText,
                language,
              });
              if (clientWs.readyState === clientWs.OPEN) {
                clientWs.send(
                  JSON.stringify({ type: 'saved_message', message: savedU })
                );
              }
            }
            if (aText) {
              const savedA = await insertChatMessage({
                chatId: activeChatId,
                role: 'assistant',
                content: aText,
                language,
              });
              if (clientWs.readyState === clientWs.OPEN) {
                clientWs.send(
                  JSON.stringify({ type: 'saved_message', message: savedA })
                );
              }
            }
          } catch (err) {
            console.warn('Live turn DB save skipped:', err);
          }
        };

        const sessionPromise = createNovaLiveSession({
          language,
          voiceName,
          voiceTone,
          userName: authedUser.name,
          onMessage: (message) => {
            if (clientWs.readyState !== clientWs.OPEN) return;

            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                const audio = part.inlineData?.data;
                if (audio) {
                  clientWs.send(JSON.stringify({ type: 'audio', audio }));
                }
              }
            }

            const inTr = message.serverContent?.inputTranscription?.text;
            if (inTr) {
              userTranscriptBuffer += inTr;
              clientWs.send(
                JSON.stringify({
                  type: 'input_transcript',
                  text: userTranscriptBuffer.trim(),
                })
              );
            }

            const outTr = message.serverContent?.outputTranscription?.text;
            if (outTr) {
              aiTranscriptBuffer += outTr;
              clientWs.send(
                JSON.stringify({
                  type: 'output_transcript',
                  text: aiTranscriptBuffer.trim(),
                })
              );
            }

            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
              void flushTurnToDb();
            } else if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: 'turn_complete' }));
              void flushTurnToDb();
            }
          },
          onError: (err) => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  error:
                    err instanceof Error ? err.message : 'Live session error',
                })
              );
            }
          },
          onClose: () => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.close();
            }
          },
        });

        const session = await sessionPromise;
        if (clientWs.readyState === clientWs.OPEN) {
          clientWs.send(JSON.stringify({ type: 'ready' }));
        }

        clientWs.on('message', (raw: RawData) => {
          try {
            const parsed = JSON.parse(raw.toString()) as {
              audio?: string;
              video?: string;
              text?: string;
              greet?: boolean;
            };
            if (parsed.audio) {
              sessionPromise
                .then((s) =>
                  s.sendRealtimeInput({
                    audio: {
                      data: parsed.audio!,
                      mimeType: 'audio/pcm;rate=16000',
                    },
                  })
                )
                .catch(() => undefined);
            } else if (parsed.video) {
              sessionPromise
                .then((s) =>
                  s.sendRealtimeInput({
                    video: {
                      data: parsed.video!,
                      mimeType: 'image/jpeg',
                    },
                  })
                )
                .catch(() => undefined);
            } else if (parsed.greet) {
              const { fullName, callName } = extractSignedUpUserName(
                authedUser?.name
              );
              const greetPrompt = `अभी साइन-अप किए हुए यूज़र "${fullName}" लाइव वॉइस सेशन में जुड़े हैं। एकदम क्यूट, मीठी, कोमल और बहुत प्यार भरी आवाज़ में मुस्कुराते हुए सिर्फ़ उनके नाम "${callName}" से उन्हें प्यार से हाय बोलो, अपना नाम NOVAAI बताओ और बहुत प्यार से पूछो कि "${callName}, आज हम किस बारे में प्यारी सी बात करें?" (सिर्फ़ 1 से 2 छोटे वाक्यों में)।`;
              sessionPromise
                .then((s) => {
                  try {
                    s.sendClientContent({
                      turns: [{ role: 'user', parts: [{ text: greetPrompt }] }],
                      turnComplete: true,
                    });
                  } catch {
                    s.sendRealtimeInput({ text: greetPrompt });
                  }
                })
                .catch(() => undefined);
            } else if (parsed.text) {
              userTranscriptBuffer = parsed.text;
              sessionPromise
                .then((s) => {
                  try {
                    s.sendClientContent({
                      turns: [{ role: 'user', parts: [{ text: parsed.text! }] }],
                      turnComplete: true,
                    });
                  } catch {
                    s.sendRealtimeInput({ text: parsed.text! });
                  }
                })
                .catch(() => undefined);
            }
          } catch {
            // ignore malformed ws message
          }
        });

        clientWs.on('close', () => {
          void flushTurnToDb();
          try {
            session.close();
          } catch {
            // ignore
          }
        });
      } catch (err) {
        if (clientWs.readyState === clientWs.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'error',
              error:
                err instanceof Error
                  ? err.message
                  : 'Gemini Live WebSocket unavailable',
            })
          );
          clientWs.close();
        }
      }
    }
  );

  // Bind port 3000 immediately (< 100ms) so AI Studio preview health probes always succeed on cold boot
  server.listen(port, '0.0.0.0', () => {
    console.log(`NOVAAI full-stack server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NOVAAI server:', err);
  process.exit(1);
});
