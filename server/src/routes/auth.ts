import { Router } from 'express';
import { userRepository } from '../data/repositories/userRepository';
import { verifyPassword } from '../utils/password';
import { toPublicUser } from '../models/types';
import { createSession, destroySession, getSessionToken, setSessionCookie, clearSessionCookie } from '../middleware/session';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = await userRepository.findByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user: toPublicUser(user) });
}));

router.post('/logout', requireAuth, (req, res) => {
  const token = getSessionToken(req);
  if (token) destroySession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
