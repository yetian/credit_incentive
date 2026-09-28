import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { apiRouter } from './routes/index';
import { authMiddleware } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'credit-incentive', time: new Date().toISOString() });
  });

  // Public auth surface (password-less tenant switching)
  app.use('/api/auth', authRouter);

  // Everything below requires a valid JWT and is tenant-isolated
  app.use('/api', authMiddleware, apiRouter);

  // Serve the built frontend (web/dist) if present.
  const webDist = path.resolve(__dirname, '../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
