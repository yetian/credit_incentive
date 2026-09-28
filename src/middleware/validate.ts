import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from '../utils/http';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodType, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new HttpError(400, 'Validation failed', result.error.issues);
    }
    if (source === 'body') {
      req.body = result.data;
    }
    next();
  };
}
