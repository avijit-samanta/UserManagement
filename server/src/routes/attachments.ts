import { Router } from 'express';
import { attachmentRepository } from '../data/repositories/attachmentRepository';
import { ticketRepository } from '../data/repositories/ticketRepository';
import { getSupabaseClient } from '../data/supabaseClient';
import { ATTACHMENTS_BUCKET } from '../data/storageBucket';
import { requireAuth } from '../middleware/requireAuth';
import { upload } from '../middleware/upload';
import { uploadAttachments } from '../services/attachmentUpload';
import { asyncHandler } from '../utils/asyncHandler';
import { toPublicAttachment } from '../models/types';
import type { Attachment, PublicUser } from '../models/types';

const router = Router();

router.use(requireAuth);

// Same visibility rule as attachmentRepository.listVisibleToUser, but for a
// single file: admin always, the uploader always, or anyone whose own
// ticket this file is attached to (covers an admin's file on a user's
// ticket, and vice versa).
async function canAccessAttachment(user: PublicUser, attachment: Attachment): Promise<boolean> {
  if (user.role === 'admin' || attachment.uploadedBy === user.id) return true;
  if (attachment.ticketId) {
    const ticket = await ticketRepository.findById(attachment.ticketId);
    if (ticket && ticket.submittedBy === user.id) return true;
  }
  return false;
}

// GET /api/attachments — the File Repository listing.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const attachments = req.user!.role === 'admin'
      ? await attachmentRepository.listAll()
      : await attachmentRepository.listVisibleToUser(req.user!.id);
    res.json({ attachments: attachments.map(toPublicAttachment) });
  }),
);

// POST /api/attachments — a direct upload into the repository, not tied to
// any ticket (the "Upload More" button). Available to both roles; requires
// a topic since there's no ticket title to default it to.
router.post(
  '/',
  upload.array('files', 5),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';

    if (files.length === 0) {
      res.status(400).json({ error: 'At least one file is required' });
      return;
    }
    if (!topic) {
      res.status(400).json({ error: 'Topic is required' });
      return;
    }

    const created = await uploadAttachments(files, {
      topic,
      ticketId: null,
      messageId: null,
      uploadedBy: req.user!,
    });

    res.status(201).json({ attachments: created.map(toPublicAttachment) });
  }),
);

// GET /api/attachments/:id/download — streams the file back with its
// original filename, enforcing the same visibility rule as the listing.
router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const attachment = await attachmentRepository.findById(req.params.id);
    if (!attachment) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    if (!(await canAccessAttachment(req.user!, attachment))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { data, error } = await getSupabaseClient().storage.from(ATTACHMENTS_BUCKET).download(attachment.storagePath);
    if (error || !data) {
      res.status(404).json({ error: 'File not found in storage' });
      return;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
    res.send(buffer);
  }),
);

// DELETE /api/attachments/:id — the uploader or an admin can delete a file.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const attachment = await attachmentRepository.findById(req.params.id);
    if (!attachment) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const isAdmin = req.user!.role === 'admin';
    const isUploader = attachment.uploadedBy === req.user!.id;
    if (!isAdmin && !isUploader) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Storage object removed first: if this fails, the metadata row stays
    // so the file isn't silently orphaned in the bucket with no record of
    // it — the delete can just be retried. The reverse order (DB row gone,
    // storage delete fails) would leave an invisible, unmanageable object.
    const { error: storageError } = await getSupabaseClient().storage.from(ATTACHMENTS_BUCKET).remove([attachment.storagePath]);
    if (storageError) throw storageError;

    await attachmentRepository.delete(attachment.id);
    res.status(204).end();
  }),
);

export default router;
