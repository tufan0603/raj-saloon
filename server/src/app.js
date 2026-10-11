import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

/** Builds the Express app (no listen) so it can run on a server or as a serverless function. */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = env.clientUrl.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        // Allow: no-origin (mobile PWA / curl / server-to-server), configured client URLs, any localhost in dev
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        if (env.nodeEnv !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) return cb(null, true);
        // Vercel preview deployments of the client
        if (/\.vercel\.app$/.test(new URL(origin).hostname) && allowedOrigins.some((o) => /\.vercel\.app$/.test(o))) return cb(null, true);
        cb(new Error(`CORS blocked for origin ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'tiny' : 'dev'));

  app.get('/', (_req, res) => res.json({ name: 'SaloonEase API', health: '/api/health' }));
  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp();
