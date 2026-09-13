import { Navigate, Outlet } from 'react-router-dom';
import { useSessionStore } from '../store/useSessionStore';

export function RequireManager(): React.JSX.Element {
  const currentEmployee = useSessionStore((state) => state.currentEmployee);

  if (currentEmployee?.role !== 'manager') {
    return <Navigate to="/my-schedule" replace />;
  }
  return <Outlet />;
}
