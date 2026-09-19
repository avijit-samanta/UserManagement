import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { TextField, SelectField } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ApiError } from '../api/client';
import { useTheme } from '../hooks/useTheme';
import type { Role } from '../types';

export function RegisterPage() {
  const { user, status, register } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated' && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await register({ name, email, password, phone, address, role });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <button
          type="button"
          className="auth-theme-toggle"
          onClick={toggle}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          data-testid="register-theme-toggle"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        <div className="auth-brand">
          <div className="auth-brand-mark" />
          <div>
            <div className="auth-brand-title">Simple Help Desk</div>
            <div className="auth-brand-subtitle">Create an account</div>
          </div>
        </div>

        <div className="auth-heading">Register</div>
        <div className="auth-subheading">Create an administrator or user account to get started.</div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <TextField
              label="Full name"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              data-testid="register-name-input"
            />
            <TextField
              label="Email address"
              type="email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="register-email-input"
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              data-testid="register-password-input"
            />
            <TextField
              label="Confirm password"
              type="password"
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              data-testid="register-confirm-password-input"
            />
            <TextField
              label="Phone number"
              fullWidth
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="register-phone-input"
            />
            <TextField
              label="Address"
              fullWidth
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              data-testid="register-address-input"
            />
            <SelectField
              label="Account type"
              fullWidth
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              data-testid="register-role-select"
            >
              <option value="user">Normal User</option>
              <option value="admin">Administrator</option>
            </SelectField>
          </div>

          <div className="form-actions">
            <Button type="submit" block disabled={submitting} data-testid="register-submit-button">
              {submitting ? 'Creating account…' : 'Create Account'}
            </Button>
          </div>
          {error && (
            <div className="form-message error" style={{ marginTop: 'var(--space-3)' }} data-testid="register-error">
              {error}
            </div>
          )}
        </form>

        <div className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
