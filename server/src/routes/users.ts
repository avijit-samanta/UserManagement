import { Router } from 'express';
import { userRepository } from '../data/repositories/userRepository';
import { toPublicUser } from '../models/types';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', asyncHandler(async (_req, res) => {
  const users = await userRepository.list();
  res.json({ users: users.map(toPublicUser) });
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
