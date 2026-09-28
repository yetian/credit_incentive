import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/http';

interface ErrorBody {
  error: string;
  details?: unknown;
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Internal Server Error';

  if (status >= 500) {
    console.error('[error]', err);
  }

  const body: ErrorBody = { error: message };
  if (err instanceof HttpError && err.details !== undefined) {
    body.details = err.details;
  }
  res.status(status).json(body);
}
