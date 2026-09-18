import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { userRepository } from '../data/repositories/userRepository';
import { toPublicUser } from '../models/types';
import type { PublicUser } from '../models/types';

const SESSION_COOKIE = 'sid';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

interface SessionRecord {
  userId: string;
  expiresAt: number;
}

const sessions = new Map<string, SessionRecord>();

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export function createSession(userId: string): string {
  const token = crypto.randomUUID();
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE);
}

export function getSessionToken(req: Request): string | undefined {
  return req.cookies?.[SESSION_COOKIE];
}

export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = getSessionToken(req);
  if (!token) return next();

  const record = sessions.get(token);
  if (!record || record.expiresAt < Date.now()) {
    sessions.delete(token);
    return next();
  }

  const user = await userRepository.findById(record.userId);
  if (user) {
    req.user = toPublicUser(user);
  }
  next();
}
