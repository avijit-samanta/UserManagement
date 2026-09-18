import { useState } from 'react';
import { TextField, TextAreaField } from '../common/Input';
import { Button } from '../common/Button';
import { ApiError } from '../../api/client';

export function TicketForm({ onSubmit }: { onSubmit: (title: string, description: string) => Promise<unknown> }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await onSubmit(title, description);
      setTitle('');
      setDescription('');
      setMessage({ type: 'success', text: 'Your request has been submitted to the administrator.' });
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Failed to submit request.';
      setMessage({ type: 'error', text });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <TextField
          label="Title"
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Brief summary of your request"
          data-testid="ticket-title-input"
        />
        <TextAreaField
          label="Description"
          fullWidth
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder="Describe your request in detail"
          data-testid="ticket-description-input"
        />
      </div>
      <div className="form-actions">
        <Button type="submit" disabled={submitting} data-testid="ticket-submit-button">
          {submitting ? 'Submitting…' : 'Submit Request'}
        </Button>
        {message && <span className={`form-message ${message.type}`}>{message.text}</span>}
      </div>
    </form>
  );
}
