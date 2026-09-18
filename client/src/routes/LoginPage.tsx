import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { TextField } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { user, status, login } = useAuth();
  const navigate = useNavigate();
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
        <div className="auth-brand">
          <div className="auth-brand-mark" />
          <div>
            <div className="auth-brand-title">NimbusDesk</div>
            <div className="auth-brand-subtitle">User Management Portal</div>
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

        <div className="auth-hint">
          Demo accounts — Admin: <strong>admin@example.com</strong> / Admin@123
          <br />
          User: <strong>user@example.com</strong> / User@123
        </div>
      </div>
    </div>
  );
}
