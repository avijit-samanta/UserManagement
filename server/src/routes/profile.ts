import { Router } from 'express';
import { userRepository } from '../data/repositories/userRepository';
import { toPublicUser } from '../models/types';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.put('/', requireAuth, asyncHandler(async (req, res) => {
  const { name, email, phone, address } = req.body ?? {};
  const updated = await userRepository.update(req.user!.id, { name, email, phone, address });
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: toPublicUser(updated) });
}));

export default router;
