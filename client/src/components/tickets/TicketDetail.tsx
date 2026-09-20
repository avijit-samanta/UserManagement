import { useRef, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { TextAreaField } from '../common/Input';
import { Button } from '../common/Button';
import { AttachmentList } from '../attachments/AttachmentList';
import { ApiError } from '../../api/client';
import type { Ticket } from '../../types';

export function TicketDetail({
  ticket,
  canReply,
  canClose,
  canReopen,
  onRespond,
  onClose,
  onReopen,
}: {
  ticket: Ticket;
  /** Can the current viewer send a new message right now? (still subject to the ticket not being closed) */
  canReply: boolean;
  /** Admin-only: show the "Close Ticket" action alongside the reply form. */
  canClose?: boolean;
  /** Ticket-owner-only: show "Reopen Ticket" once the ticket is closed. */
  canReopen?: boolean;
  onRespond?: (response: string, files: File[]) => Promise<unknown>;
  onClose?: () => Promise<unknown>;
  onReopen?: () => Promise<unknown>;
}) {
  const [response, setResponse] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isClosed = ticket.status === 'closed';

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault();
    if (!onRespond) return;
    setSubmitting(true);
    setError(null);
    try {
      await onRespond(response, files);
      setResponse('');
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send response.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose() {
    if (!onClose) return;
    setClosing(true);
    setError(null);
    try {
      await onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to close ticket.');
    } finally {
      setClosing(false);
    }
  }

  async function handleReopen() {
    if (!onReopen) return;
    setReopening(true);
    setError(null);
    try {
      await onReopen();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reopen ticket.');
    } finally {
      setReopening(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <div className="card-title">{ticket.title}</div>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="ticket-meta-row">
        <span className="ticket-meta-label">Ticket ID</span>
        <span>{ticket.id}</span>
      </div>
      <div className="ticket-meta-row">
        <span className="ticket-meta-label">Submitted by</span>
        <span>{ticket.submittedByName}</span>
      </div>
      <div className="ticket-meta-row">
        <span className="ticket-meta-label">Submitted</span>
        <span>{new Date(ticket.createdAt).toLocaleString()}</span>
      </div>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <div className="form-label" style={{ marginBottom: 'var(--space-1)' }}>
          Description
        </div>
        <p style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>{ticket.description}</p>
        <AttachmentList attachments={ticket.attachments} />
      </div>

      <div style={{ marginTop: 'var(--space-4)' }} data-testid="ticket-messages">
        <div className="form-label" style={{ marginBottom: 'var(--space-1)' }}>
          Conversation
        </div>
        {ticket.messages.length === 0 ? (
          <div className="response-block-empty">No messages yet.</div>
        ) : (
          ticket.messages.map((message) => (
            <div key={message.id} className={`message-item ${message.authorRole}`} data-testid="ticket-message">
              <div className="message-meta">
                <span>{message.authorName}</span>
                <span>{new Date(message.createdAt).toLocaleString()}</span>
              </div>
              <p style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>{message.body}</p>
              <AttachmentList attachments={message.attachments} />
            </div>
          ))
        )}
      </div>

      {canReply && !isClosed && (
        <form onSubmit={handleRespond} style={{ marginTop: 'var(--space-5)' }}>
          <TextAreaField
            label="Write a message"
            fullWidth
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            required
            data-testid="ticket-respond-textarea"
          />
          <div className="form-field full-width" style={{ marginTop: 'var(--space-2)' }}>
            <label className="form-label">Attach files (optional)</label>
            <input
              ref={fileInputRef}
              className="form-input"
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              data-testid="ticket-respond-attach-input"
            />
            {files.length > 0 && (
              <div className="form-hint" data-testid="ticket-respond-attach-selected">
                {files.map((f) => f.name).join(', ')}
              </div>
            )}
          </div>
          <div className="form-actions">
            <Button type="submit" disabled={submitting} data-testid="ticket-respond-button">
              {submitting ? 'Sending…' : 'Send Message'}
            </Button>
            {canClose && (
              <Button
                type="button"
                variant="secondary"
                disabled={closing}
                onClick={handleClose}
                data-testid="ticket-close-button"
              >
                {closing ? 'Closing…' : 'Close Ticket'}
              </Button>
            )}
            {error && <span className="form-message error">{error}</span>}
          </div>
        </form>
      )}

      {canReopen && isClosed && (
        <div className="form-actions" style={{ marginTop: 'var(--space-5)' }}>
          <Button type="button" disabled={reopening} onClick={handleReopen} data-testid="ticket-reopen-button">
            {reopening ? 'Reopening…' : 'Reopen Ticket'}
          </Button>
          {error && <span className="form-message error">{error}</span>}
        </div>
      )}
    </div>
  );
}
