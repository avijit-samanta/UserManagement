import { useAuth } from '../auth/AuthContext';
import { UserDashboardPage } from './UserDashboardPage';
import { AdminDashboardPage } from './AdminDashboardPage';

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'admin' ? <AdminDashboardPage /> : <UserDashboardPage />;
}
