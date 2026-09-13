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
  return <Outlet />;
}
