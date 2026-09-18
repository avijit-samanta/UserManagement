import { Router } from 'express';
import { ticketRepository } from '../data/repositories/ticketRepository';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth);

router.post('/', asyncHandler(async (req, res) => {
  if (req.user!.role !== 'user') {
    res.status(403).json({ error: 'Only normal users can submit tickets' });
    return;
  }

  const { title, description } = req.body ?? {};
  if (typeof title !== 'string' || !title.trim() || typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ error: 'Title and description are required' });
    return;
  }

  const ticket = await ticketRepository.create({
    title: title.trim(),
    description: description.trim(),
    submittedBy: req.user!.id,
    submittedByName: req.user!.name,
  });
  res.status(201).json({ ticket });
}));

router.get('/', asyncHandler(async (req, res) => {
  const tickets = req.user!.role === 'admin'
    ? await ticketRepository.list()
    : await ticketRepository.listByUser(req.user!.id);
  res.json({ tickets });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const ticket = await ticketRepository.findById(req.params.id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  if (req.user!.role !== 'admin' && ticket.submittedBy !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json({ ticket });
}));

router.put('/:id/respond', requireRole('admin'), asyncHandler(async (req, res) => {
  const { response } = req.body ?? {};
  if (typeof response !== 'string' || !response.trim()) {
    res.status(400).json({ error: 'Response text is required' });
    return;
  }

  const ticket = await ticketRepository.respond(req.params.id, response.trim(), req.user!.id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  res.json({ ticket });
}));

export default router;
