import { useEffect, useState } from 'react';
import { TextField } from '../common/Input';
import { Button } from '../common/Button';
import { ApiError } from '../../api/client';
import type { PublicUser } from '../../types';

export interface ProfileFormValues {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export function ProfileForm({
  user,
  onSave,
  testIdPrefix = 'profile',
}: {
  user: PublicUser;
  onSave: (values: ProfileFormValues) => Promise<unknown>;
  testIdPrefix?: string;
}) {
  const [values, setValues] = useState<ProfileFormValues>({
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setValues({ name: user.name, email: user.email, phone: user.phone, address: user.address });
    setMessage(null);
  }, [user.id]);

  function update<K extends keyof ProfileFormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await onSave(values);
      setMessage({ type: 'success', text: 'Profile saved successfully.' });
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Failed to save profile.';
      setMessage({ type: 'error', text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <TextField
          label="Full name"
          value={values.name}
          onChange={(e) => update('name', e.target.value)}
          required
          data-testid={`${testIdPrefix}-name-input`}
        />
        <TextField
          label="Email address"
          type="email"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          required
          data-testid={`${testIdPrefix}-email-input`}
        />
        <TextField
          label="Phone number"
          value={values.phone}
          onChange={(e) => update('phone', e.target.value)}
          required
          data-testid={`${testIdPrefix}-phone-input`}
        />
        <TextField
          label="Address"
          value={values.address}
          onChange={(e) => update('address', e.target.value)}
          required
          data-testid={`${testIdPrefix}-address-input`}
        />
      </div>
      <div className="form-actions">
        <Button type="submit" disabled={saving} data-testid={`${testIdPrefix}-save-button`}>
          {saving ? 'Saving…' : 'Update & Save'}
        </Button>
        {message && <span className={`form-message ${message.type}`}>{message.text}</span>}
      </div>
    </form>
  );
}
