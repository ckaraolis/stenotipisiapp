import { Navigate, useLocation } from 'react-router-dom';
import { canAccessPath, getDefaultPath } from '../../config/permissions';
import { getAuthUser } from '../../utils/auth';

interface PermissionRouteProps {
  children: React.ReactNode;
}

export default function PermissionRoute({ children }: PermissionRouteProps) {
  const location = useLocation();
  const user = getAuthUser();

  if (!canAccessPath(user?.roles ?? user?.role, location.pathname)) {
    return <Navigate to={getDefaultPath(user?.roles ?? user?.role)} replace />;
  }

  return children;
}
