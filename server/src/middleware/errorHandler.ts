import type { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_REQUEST } from '../middleware/upload';

// A rejected upload (too large, too many files, wrong field name) is a
// client mistake, not a server fault — surface it as a 400 with a message
// the UI can show directly, instead of falling through to the generic 500.
function multerErrorMessage(err: MulterError): string {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return `File exceeds the maximum allowed size (${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB).`;
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return `Too many files attached (max ${MAX_FILES_PER_REQUEST} per request).`;
    default:
      return err.message;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof MulterError) {
    res.status(400).json({ error: multerErrorMessage(err) });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
