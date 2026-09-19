import { Router } from 'express';
import { userRepository } from '../data/repositories/userRepository';
import { hashPassword } from '../utils/password';
import { toPublicUser } from '../models/types';
import type { Role } from '../models/types';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', asyncHandler(async (_req, res) => {
  const users = await userRepository.list();
  res.json({ users: users.map(toPublicUser) });
}));

// Admin-only: create a user account directly (no self-registration flow).
router.post('/', asyncHandler(async (req, res) => {
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
  res.status(201).json({ user: toPublicUser(user) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const user = await userRepository.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: toPublicUser(user) });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { name, email, phone, address } = req.body ?? {};
  const updated = await userRepository.update(req.params.id, { name, email, phone, address });
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: toPublicUser(updated) });
}));

export default router;
