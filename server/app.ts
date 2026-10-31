import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes/index.ts';
import { errorHandler } from './middleware/errorHandler.ts';

export function createApiApp() {
  const app = express();

  app.set('trust proxy', 1);

  // Configure Helmet so cross-origin preview iframe, Firebase Google OAuth popups
  // (window.opener postMessage), and inline PDF previews all work reliably.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      originAgentCluster: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      frameguard: false,
    })
  );

  app.use(
    cors({
      origin: true,
      credentials: true,
      exposedHeaders: ['X-Note-Downloads', 'Content-Disposition'],
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'novaai' });
  });

  app.use('/api', apiRouter);

  // API 404 handler
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Requested API endpoint does not exist.' });
  });

  app.use(errorHandler);

  return app;
}
