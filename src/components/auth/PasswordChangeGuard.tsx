import { Navigate, useLocation } from 'react-router-dom';
import { getAuthUser } from '../../utils/auth';

interface PasswordChangeGuardProps {
  children: React.ReactNode;
}

/** Blocks app access until a system-issued password has been changed. */
export default function PasswordChangeGuard({ children }: PasswordChangeGuardProps) {
  const user = getAuthUser();
  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

interface ChangePasswordOnlyRouteProps {
  children: React.ReactNode;
}

/** Allows only users who must change their password (or redirects others away). */
export function ChangePasswordOnlyRoute({ children }: ChangePasswordOnlyRouteProps) {
  const location = useLocation();
  const user = getAuthUser();

  if (!user?.mustChangePassword && location.pathname === '/change-password') {
    return <Navigate to="/" replace />;
  }

  return children;
}
