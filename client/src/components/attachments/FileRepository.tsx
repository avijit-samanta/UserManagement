import { useEffect, useRef, useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { TextField } from '../common/Input';
import { attachmentsApi } from '../../api/attachments';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { FileTable } from './FileTable';
import type { Attachment } from '../../types';

// Shown to both roles (see UserDashboardPage / AdminDashboardPage): every
// file the current user sent to the admin, or that the admin sent them, for
// a normal user; every file in the system for an admin. Visibility is
// entirely decided server-side (GET /api/attachments) — this component just
// renders whatever comes back and lets the viewer upload or delete.
export function FileRepository() {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const { attachments } = await attachmentsApi.list();
    setAttachments(attachments);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      setMessage({ type: 'error', text: 'Choose at least one file to upload.' });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      await attachmentsApi.upload(topic, files);
      setTopic('');
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage({ type: 'success', text: 'File(s) uploaded to the repository.' });
      await refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setMessage(null);
    try {
      await attachmentsApi.remove(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Failed to delete file.' });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card title="File Repository" subtitle={`${attachments.length} file(s)`}>
      <form onSubmit={handleUpload} className="upload-form" data-testid="file-repo-upload-form">
        <div className="form-grid">
          <TextField
            label="Topic"
            fullWidth
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            placeholder="What is this file about?"
            data-testid="file-repo-topic-input"
          />
          <div className="form-field full-width">
            <label className="form-label">File(s)</label>
            <input
              ref={fileInputRef}
              className="form-input"
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              data-testid="file-repo-file-input"
            />
          </div>
        </div>
        <div className="form-actions">
          <Button type="submit" disabled={uploading} data-testid="file-repo-upload-button">
            {uploading ? 'Uploading…' : '+ Upload File'}
          </Button>
          {message && <span className={`form-message ${message.type}`}>{message.text}</span>}
        </div>
      </form>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : attachments.length === 0 ? (
        <div className="empty-state">No files yet.</div>
      ) : (
        <FileTable
          attachments={attachments}
          currentUserId={user?.id}
          isAdmin={user?.role === 'admin'}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
      )}
    </Card>
  );
}
