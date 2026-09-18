import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';

export function LogoutConfirmPage() {
  return (
    <div className="logout-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-brand" style={{ justifyContent: 'center' }}>
          <div className="auth-brand-mark" />
        </div>
        <div className="auth-heading">You've been logged out</div>
        <div className="auth-subheading">Thanks for using NimbusDesk. Your session has been ended securely.</div>
        <Link to="/login">
          <Button block data-testid="back-to-login-button">
            Back to Sign In
          </Button>
        </Link>
      </div>
    </div>
  );
}
