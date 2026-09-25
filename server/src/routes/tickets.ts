import { Router } from 'express';
import { ticketRepository } from '../data/repositories/ticketRepository';
import { attachmentRepository } from '../data/repositories/attachmentRepository';
import { getSupabaseClient } from '../data/supabaseClient';
import { ATTACHMENTS_BUCKET } from '../data/storageBucket';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { upload } from '../middleware/upload';
import { uploadAttachments } from '../services/attachmentUpload';
import { asyncHandler } from '../utils/asyncHandler';
import { toPublicAttachment } from '../models/types';
import type { Ticket } from '../models/types';

const router = Router();

router.use(requireAuth);

// Fills in the computed attachments fields (see models/types.ts) from a
// caller-supplied list of that ticket's attachments — the ticket/message
// objects in db.json never carry this themselves. Split from the DB read so
// listing many tickets (below) can fetch every attachment once instead of
// once per ticket.
function enrichTicket(ticket: Ticket, attachments: ReturnType<typeof toPublicAttachment>[]): Ticket {
  return {
    ...ticket,
    attachments: attachments.filter((a) => a.messageId === null),
    messages: ticket.messages.map((message) => ({
      ...message,
      attachments: attachments.filter((a) => a.messageId === message.id),
    })),
  };
}

// Single-ticket version used by create / get-by-id / respond / close /
// reopen, where a normal user's list is a rounding error compared to a
// separate DB round trip per call anyway.
async function withAttachments(ticket: Ticket): Promise<Ticket> {
  const attachments = (await attachmentRepository.listForTicket(ticket.id)).map(toPublicAttachment);
  return enrichTicket(ticket, attachments);
}

function extractFiles(req: { files?: unknown }): Express.Multer.File[] {
  return (req.files as Express.Multer.File[] | undefined) ?? [];
}

router.post('/', upload.array('files', 5), asyncHandler(async (req, res) => {
  const files = extractFiles(req);

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

  if (files.length > 0) {
    await uploadAttachments(files, {
      topic: ticket.title,
      ticketId: ticket.id,
      messageId: null,
      uploadedBy: req.user!,
    });
  }

  res.status(201).json({ ticket: await withAttachments(ticket) });
}));

// The dashboard opens a ticket's details straight from this list response
// (no separate GET /:id round trip on click — see TicketList/onSelect on
// the client), so the list has to carry attachments too, not just the
// detail endpoint. One listAll() covers every ticket instead of one DB read
// per ticket.
router.get('/', asyncHandler(async (req, res) => {
  const tickets = req.user!.role === 'admin'
    ? await ticketRepository.list()
    : await ticketRepository.listByUser(req.user!.id);

  const allAttachments = (await attachmentRepository.listAll()).map(toPublicAttachment);
  const byTicket = new Map<string, typeof allAttachments>();
  for (const attachment of allAttachments) {
    if (!attachment.ticketId) continue;
    const bucket = byTicket.get(attachment.ticketId) ?? [];
    bucket.push(attachment);
    byTicket.set(attachment.ticketId, bucket);
  }

  res.json({ tickets: tickets.map((ticket) => enrichTicket(ticket, byTicket.get(ticket.id) ?? [])) });
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
  res.json({ ticket: await withAttachments(ticket) });
}));

// Both the admin and the ticket's own submitter can append as many messages
// as needed to the conversation, as long as it isn't closed. Anyone else
// (a different normal user) is forbidden.
router.put('/:id/respond', upload.array('files', 5), asyncHandler(async (req, res) => {
  const files = extractFiles(req);
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
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  if (files.length > 0) {
    const newMessage = ticket.messages[ticket.messages.length - 1];
    await uploadAttachments(files, {
      topic: ticket.title,
      ticketId: ticket.id,
      messageId: newMessage.id,
      uploadedBy: req.user!,
    });
  }

  res.json({ ticket: await withAttachments(ticket) });
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
  res.json({ ticket: await withAttachments(ticket!) });
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
  res.json({ ticket: await withAttachments(ticket!) });
}));

// The admin can delete any ticket; a normal user only their own.
router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await ticketRepository.findById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  if (req.user!.role !== 'admin' && existing.submittedBy !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // Same ordering rule as DELETE /api/attachments/:id: storage objects
  // first, so a storage failure leaves the ticket (and its attachment rows)
  // in place for a retry instead of orphaning files in the bucket. The DB
  // cascade then removes the messages and attachment rows.
  const attachments = await attachmentRepository.listForTicket(existing.id);
  if (attachments.length > 0) {
    const { error: storageError } = await getSupabaseClient()
      .storage.from(ATTACHMENTS_BUCKET)
      .remove(attachments.map((a) => a.storagePath));
    if (storageError) throw storageError;
  }

  await ticketRepository.delete(existing.id);
  res.status(204).end();
}));

export default router;
