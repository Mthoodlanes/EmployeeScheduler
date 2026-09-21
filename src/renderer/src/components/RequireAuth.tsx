import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '../store/useSessionStore';

export function RequireAuth(): React.JSX.Element {
  const currentEmployee = useSessionStore((state) => state.currentEmployee);
  const isFirstRun = useSessionStore((state) => state.isFirstRun);

  if (isFirstRun) {
    return <Navigate to="/first-run" replace />;
  }
  if (!currentEmployee) {
    return <Navigate to="/login" replace />;
  }
  // A Secretary account has no access to the normal scheduling app at all —
  // it's reached only through its own door (see RequireSecretaryAuth.tsx) —
  // so bounce it straight to its own area rather than letting it land on
  // whatever page it happened to request.
  if (currentEmployee.role === 'secretary') {
    return <Navigate to="/secretary" replace />;
  }
  return <Outlet />;
}
