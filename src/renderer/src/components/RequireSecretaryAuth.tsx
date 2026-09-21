import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '../store/useSessionStore';

/**
 * The Secretary area's equivalent of `RequireAuth` — deliberately separate
 * rather than reusing it, since an unauthenticated visitor here needs to
 * land on `/secretary/login` (its own door), not the normal `/login`. A
 * manager also gets full access here (not just `secretary`-role accounts) —
 * a manager already has authority over everything else in the app, so
 * there's no reason dues tracking should be the one area they're locked
 * out of; they just don't have to log in twice, since their existing
 * session already qualifies. Anyone else signed in gets bounced to the
 * normal app instead of seeing anything under `/secretary`, mirroring
 * `RequireAuth`'s reverse bounce for a Secretary account landing on a
 * normal route.
 */
export function RequireSecretaryAuth(): React.JSX.Element {
  const currentEmployee = useSessionStore((state) => state.currentEmployee);
  const isFirstRun = useSessionStore((state) => state.isFirstRun);

  if (isFirstRun) {
    return <Navigate to="/first-run" replace />;
  }
  if (!currentEmployee) {
    return <Navigate to="/secretary/login" replace />;
  }
  if (currentEmployee.role !== 'secretary' && currentEmployee.role !== 'manager') {
    return <Navigate to="/my-schedule" replace />;
  }
  return <Outlet />;
}
