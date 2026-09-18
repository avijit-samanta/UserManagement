import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 does not forward a rejected promise from an async route handler
// to error middleware — it becomes an unhandled rejection and, by default,
// crashes the whole Node process. Wrapping every handler with this catches
// the rejection and hands it to next(), so one bad request (or a transient
// I/O error) can never take the server down.
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
