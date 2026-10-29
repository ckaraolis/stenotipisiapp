import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInactivityLogout } from '../../hooks/useInactivityLogout';
import { signOut } from '../../utils/auth';

export default function InactivityMonitor() {
  const navigate = useNavigate();

  const handleTimeout = useCallback(() => {
    void signOut().then(() => {
      navigate('/signin', { replace: true, state: { sessionExpired: true } });
    });
  }, [navigate]);

  useInactivityLogout(handleTimeout);

  return null;
}
