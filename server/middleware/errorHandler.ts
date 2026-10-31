import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (res.headersSent) {
    return;
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    res.status(400).json({
      error: firstIssue
        ? `${firstIssue.path.join('.') ? `${firstIssue.path.join('.')}: ` : ''}${firstIssue.message}`
        : 'Validation error.',
      details: err.issues,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'File exceeds the 25MB maximum upload limit.',
      });
      return;
    }
    res.status(400).json({
      error: `Upload error: ${err.message}`,
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error('Unhandled API error:', err);
  const message =
    err instanceof Error && err.message
      ? err.message
      : 'An unexpected server error occurred.';
  res.status(500).json({ error: message });
}
