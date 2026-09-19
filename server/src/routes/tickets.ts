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

// Both the admin and the ticket's own submitter can append as many messages
// as needed to the conversation, as long as it isn't closed. Anyone else
// (a different normal user) is forbidden.
router.put('/:id/respond', asyncHandler(async (req, res) => {
  const { response } = req.body ?? {};
  if (typeof response !== 'string' || !response.trim()) {
    res.status(400).json({ error: 'Response text is required' });
    return;
  }

  const existing = await ticketRepository.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const isAdmin = req.user!.role === 'admin';
  const isSubmitter = existing.submittedBy === req.user!.id;
  if (!isAdmin && !isSubmitter) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (existing.status === 'closed') {
    res.status(400).json({ error: 'Cannot respond to a closed ticket' });
    return;
  }

  const ticket = await ticketRepository.addMessage(
    req.params.id,
    response.trim(),
    req.user!.id,
    req.user!.name,
    req.user!.role,
  );
  res.json({ ticket });
}));

router.put('/:id/close', requireRole('admin'), asyncHandler(async (req, res) => {
  const existing = await ticketRepository.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  if (existing.status === 'closed') {
    res.status(400).json({ error: 'Ticket is already closed' });
    return;
  }

  const ticket = await ticketRepository.close(req.params.id);
  res.json({ ticket });
}));

// The submitter can reopen their own closed ticket, sending it back to the
// administrator's queue for further attention.
router.put('/:id/reopen', asyncHandler(async (req, res) => {
  const existing = await ticketRepository.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  if (existing.submittedBy !== req.user!.id) {
    res.status(403).json({ error: 'Only the ticket submitter can reopen it' });
    return;
  }
  if (existing.status !== 'closed') {
    res.status(400).json({ error: 'Only closed tickets can be reopened' });
    return;
  }

  const ticket = await ticketRepository.reopen(req.params.id);
  res.json({ ticket });
}));

export default router;
