import { Router } from 'express';
import { userRepository } from '../data/repositories/userRepository';
import { verifyPassword, hashPassword } from '../utils/password';
import { toPublicUser } from '../models/types';
import type { Role } from '../models/types';
import { createSession, destroySession, getSessionToken, setSessionCookie, clearSessionCookie } from '../middleware/session';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, phone, address, role } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (typeof email !== 'string' || !email.trim()) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  if (role !== 'admin' && role !== 'user') {
    res.status(400).json({ error: 'Role must be "admin" or "user"' });
    return;
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const user = await userRepository.create({
    email: email.trim(),
    passwordHash: hashPassword(password),
    role: role as Role,
    name: name.trim(),
    phone: typeof phone === 'string' ? phone.trim() : '',
    address: typeof address === 'string' ? address.trim() : '',
  });

  const token = createSession(user.id);
  setSessionCookie(res, token);
  res.status(201).json({ user: toPublicUser(user) });
}));

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
