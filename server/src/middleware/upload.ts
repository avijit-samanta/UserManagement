import multer from 'multer';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file
export const MAX_FILES_PER_REQUEST = 5;

// Memory storage, not disk: files land in req.files[i].buffer, ready to
// hand straight to Supabase Storage (see routes/attachments.ts,
// routes/tickets.ts) with nothing ever written to local disk. That also
// means a request rejected after multer parses it (missing topic, wrong
// ticket, etc.) leaves nothing behind to clean up — unlike the old
// disk-storage version, there's no cleanupUploadedFiles() step needed
// anymore; an unused buffer just gets garbage collected.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES_PER_REQUEST },
});
