export const ATTACHMENTS_BUCKET = 'attachments';

// Object path inside the bucket for a given attachment. Namespaced by
// ticket (or "standalone" for a repository-only upload with no ticket) so
// objects are easy to browse/audit directly in the Supabase Storage UI,
// with the attachment's own generated id keeping it unique regardless of
// the original filename.
export function buildStoragePath(ticketId: string | null, attachmentId: string, fileName: string): string {
  const folder = ticketId ?? 'standalone';
  return `${folder}/${attachmentId}-${fileName}`;
}
