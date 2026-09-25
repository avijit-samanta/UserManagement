import { Router } from 'express';
import { userRepository } from '../data/repositories/userRepository';
import { ticketRepository } from '../data/repositories/ticketRepository';
import { attachmentRepository } from '../data/repositories/attachmentRepository';
import { getSupabaseClient } from '../data/supabaseClient';
import { ATTACHMENTS_BUCKET } from '../data/storageBucket';
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

// Removes the account along with everything it owns: its tickets (their
// messages and attachment rows cascade) and any file it uploaded.
router.delete('/:id', asyncHandler(async (req, res) => {
  const target = await userRepository.findById(req.params.id);
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  // Also guarantees at least one admin always remains.
  if (target.id === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }
  // Checked before anything is removed, so a refusal leaves no partial delete.
  if (await ticketRepository.hasMessagesOnOthersTickets(target.id)) {
    res.status(409).json({
      error: "This account has replied on other users' tickets and can't be deleted without losing that history",
    });
    return;
  }

  // Storage objects first, same reasoning as DELETE /api/tickets/:id: a
  // storage failure then leaves every row in place for a retry.
  // listVisibleToUser = files they uploaded + files on their tickets.
  const attachments = await attachmentRepository.listVisibleToUser(target.id);
  if (attachments.length > 0) {
    const { error: storageError } = await getSupabaseClient()
      .storage.from(ATTACHMENTS_BUCKET)
      .remove(attachments.map((a) => a.storagePath));
    if (storageError) throw storageError;
  }

  await ticketRepository.deleteByUser(target.id);
  await attachmentRepository.deleteByUploader(target.id);
  await userRepository.delete(target.id);
  res.status(204).end();
}));

export default router;
