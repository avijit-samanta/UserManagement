import { useState } from 'react';
import { TextField, SelectField } from '../common/Input';
import { Button } from '../common/Button';
import { ApiError } from '../../api/client';
import { usersApi } from '../../api/users';
import type { PublicUser, Role } from '../../types';

export function AddUserForm({ onCreated }: { onCreated: (user: PublicUser) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await usersApi.create({ name, email, password, phone, address, role });
      onCreated(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Add New User</div>
      <div className="form-grid">
        <TextField
          label="Full name"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          data-testid="add-user-name-input"
        />
        <TextField
          label="Email address"
          type="email"
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          data-testid="add-user-email-input"
        />
        <TextField
          label="Temporary password"
          type="password"
          fullWidth
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          data-testid="add-user-password-input"
        />
        <TextField
          label="Phone number"
          fullWidth
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          data-testid="add-user-phone-input"
        />
        <TextField
          label="Address"
          fullWidth
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          data-testid="add-user-address-input"
        />
        <SelectField
          label="Role"
          fullWidth
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          data-testid="add-user-role-select"
        >
          <option value="user">Normal User</option>
          <option value="admin">Administrator</option>
        </SelectField>
      </div>
      <div className="form-actions">
        <Button type="submit" disabled={submitting} data-testid="add-user-submit-button">
          {submitting ? 'Creating…' : 'Create User'}
        </Button>
        {error && <span className="form-message error">{error}</span>}
      </div>
    </form>
  );
}
