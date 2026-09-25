import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { TextField } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ApiError } from '../api/client';
import { useTheme } from '../hooks/useTheme';

export function LoginPage() {
  const { user, status, login } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated' && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
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
          data-testid="login-theme-toggle"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        <div className="auth-brand">
          <div className="auth-brand-mark" />
          <div>
            <div className="auth-brand-title">Simple Help Desk</div>
            <div className="auth-brand-subtitle">Support Ticket Portal</div>
          </div>
        </div>

        <div className="auth-heading">Sign in</div>
        <div className="auth-subheading">Use your administrator or user account to continue.</div>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Email address"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            data-testid="login-email-input"
          />
          <div style={{ height: 'var(--space-4)' }} />
          <TextField
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            data-testid="login-password-input"
          />
          <div className="form-actions">
            <Button type="submit" block disabled={submitting} data-testid="login-submit-button">
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </div>
          {error && (
            <div className="form-message error" style={{ marginTop: 'var(--space-3)' }} data-testid="login-error">
              {error}
            </div>
          )}
        </form>

        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', fontWeight: 'var(--font-weight-medium)' }}>
            Quick Demo Login:
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              type="button"
              variant="success"
              className="btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                setEmail('admin@example.com');
                setPassword('Admin@123');
              }}
              data-testid="fill-admin-button"
            >
              Demo Admin
            </Button>
            <Button
              type="button"
              variant="success"
              className="btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                setEmail('user@example.com');
                setPassword('User@123');
              }}
              data-testid="fill-user-button"
            >
              Demo User
            </Button>
          </div>
        </div>

        <div className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
