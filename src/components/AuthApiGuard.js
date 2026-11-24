import { useAuth } from '../utils/auth';
import SystemStatusPage from './SystemStatusPage';

/** When a signed-in session can't reach the API, show the system-down page. */
function AuthApiGuard({ children }) {
  const { apiUnreachable } = useAuth();
  if (apiUnreachable) {
    return <SystemStatusPage kind="offline" />;
  }
  return children;
}

export default AuthApiGuard;