import { getSupabaseClient } from '../data/supabaseClient';
import { attachmentRepository } from '../data/repositories/attachmentRepository';
import { ATTACHMENTS_BUCKET, buildStoragePath } from '../data/storageBucket';
import { generateUuid } from '../utils/id';
import type { Attachment, PublicUser } from '../models/types';

export interface AttachmentUploadContext {
  topic: string;
  ticketId: string | null;
  messageId: string | null;
  uploadedBy: PublicUser;
}

// Uploads each file to Supabase Storage, then records its metadata row —
// in that order, per file, so a Storage failure never leaves a metadata
// row with no file behind it. Used by both the standalone repository
// upload (routes/attachments.ts) and ticket/reply attachments
// (routes/tickets.ts).
export async function uploadAttachments(
  files: Express.Multer.File[],
  ctx: AttachmentUploadContext,
): Promise<Attachment[]> {
  const supabase = getSupabaseClient();

  return Promise.all(
    files.map(async (file) => {
      const id = generateUuid();
      const storagePath = buildStoragePath(ctx.ticketId, id, file.originalname);

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
      if (uploadError) throw uploadError;

      return attachmentRepository.create({
        id,
        fileName: file.originalname,
        storagePath,
        mimeType: file.mimetype,
        size: file.size,
        topic: ctx.topic,
        ticketId: ctx.ticketId,
        messageId: ctx.messageId,
        uploadedBy: ctx.uploadedBy.id,
        uploadedByName: ctx.uploadedBy.name,
        uploadedByRole: ctx.uploadedBy.role,
      });
    }),
  );
}
