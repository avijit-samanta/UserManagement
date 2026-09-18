import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './routes/LoginPage';
import { LogoutConfirmPage } from './routes/LogoutConfirmPage';
import { DashboardPage } from './routes/DashboardPage';

function RoleRedirect() {
  const { user, status } = useAuth();
  if (status === 'loading') return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/logout" element={<LogoutConfirmPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/" element={<RoleRedirect />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            {/* Kept for anyone with the old admin link bookmarked */}
            <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
