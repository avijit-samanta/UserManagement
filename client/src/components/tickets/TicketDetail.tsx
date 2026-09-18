import { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { TextAreaField } from '../common/Input';
import { Button } from '../common/Button';
import { ApiError } from '../../api/client';
import type { Ticket } from '../../types';

export function TicketDetail({
  ticket,
  canRespond,
  onRespond,
}: {
  ticket: Ticket;
  canRespond: boolean;
  onRespond?: (response: string) => Promise<unknown>;
}) {
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault();
    if (!onRespond) return;
    setSubmitting(true);
    setError(null);
    try {
      await onRespond(response);
      setResponse('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send response.');
    } finally {
      setSubmitting(false);
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
      </div>

      {ticket.adminResponse ? (
        <div className="response-block" data-testid="ticket-response-text">
          <div className="form-label" style={{ marginBottom: 'var(--space-1)' }}>
            Administrator response
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6 }}>{ticket.adminResponse}</p>
        </div>
      ) : (
        <div className="response-block-empty">Awaiting a response from the administrator.</div>
      )}

      {canRespond && ticket.status === 'open' && (
        <form onSubmit={handleRespond} style={{ marginTop: 'var(--space-5)' }}>
          <TextAreaField
            label="Write a response"
            fullWidth
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            required
            data-testid="ticket-respond-textarea"
          />
          <div className="form-actions">
            <Button type="submit" disabled={submitting} data-testid="ticket-respond-button">
              {submitting ? 'Sending…' : 'Send Response'}
            </Button>
            {error && <span className="form-message error">{error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
