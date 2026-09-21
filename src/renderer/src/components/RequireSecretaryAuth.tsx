import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '../store/useSessionStore';
import { canAccessSecretaryArea } from '../utils/secretaryAccess';

/**
 * The Secretary area's equivalent of `RequireAuth` — deliberately separate
 * rather than reusing it, since an unauthenticated visitor here needs to
 * land on `/secretary/login` (its own door), not the normal `/login`.
 * Anyone `canAccessSecretaryArea` doesn't recognize gets bounced to the
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
  if (!canAccessSecretaryArea(currentEmployee)) {
    return <Navigate to="/my-schedule" replace />;
  }
  return <Outlet />;
}
