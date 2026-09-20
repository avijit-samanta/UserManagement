import { attachmentsApi } from '../../api/attachments';
import { formatFileSize } from './formatFileSize';
import type { Attachment } from '../../types';

// A read-only inline list of files attached to a ticket or one of its
// messages — download only. Managing (deleting) a file happens in the File
// Repository section instead, so this stays simple wherever it's embedded.
export function AttachmentList({ attachments }: { attachments?: Attachment[] }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <ul className="attachment-list" data-testid="attachment-list">
      {attachments.map((attachment) => (
        <li key={attachment.id} className="attachment-chip" data-testid="attachment-chip">
          <a href={attachmentsApi.downloadUrl(attachment.id)} target="_blank" rel="noreferrer" data-testid="attachment-download-link">
            📎 {attachment.fileName}
          </a>
          <span className="attachment-size">{formatFileSize(attachment.size)}</span>
        </li>
      ))}
    </ul>
  );
}
