import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../theme/ThemeProvider';
import { useSessionStore } from '../store/useSessionStore';
import { api } from '../api/client';
import { IconBowlingPin, IconMoon, IconSun } from './icons';

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-nav-link active' : 'app-nav-link';
}

export function AppLayout(): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const currentEmployee = useSessionStore((state) => state.currentEmployee);
  const setSession = useSessionStore((state) => state.setSession);
  const isManager = currentEmployee?.role === 'manager';

  const handleLogout = async (): Promise<void> => {
    await api.auth.logout();
    setSession(null);
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <span className="app-nav-brand">
          <span className="app-nav-brand-mark" aria-hidden="true">
            <IconBowlingPin />
          </span>
          Mt Hood Lanes
        </span>
        <NavLink to="/my-schedule" className={navLinkClassName}>
          My Schedule
        </NavLink>
        <NavLink to="/time-off/request" className={navLinkClassName}>
          Request Time Off
        </NavLink>
        {isManager && (
          <>
            <NavLink to="/time-off" className={navLinkClassName}>
              Time Off Queue
            </NavLink>
            <NavLink to="/schedule" className={navLinkClassName}>
              Schedule Board
            </NavLink>
            <NavLink to="/employees" className={navLinkClassName}>
              Employees
            </NavLink>
            <NavLink to="/shift-templates" className={navLinkClassName}>
              Shift Templates
            </NavLink>
            <NavLink to="/store-hours" className={navLinkClassName}>
              Store Hours
            </NavLink>
          </>
        )}
        <span className="app-nav-spacer" />
        <button
          type="button"
          className="btn btn-link"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? (
            <>
              <IconMoon /> Dark mode
            </>
          ) : (
            <>
              <IconSun /> Light mode
            </>
          )}
        </button>
        {currentEmployee && (
          <span className="app-nav-user">
            {currentEmployee.name} ({currentEmployee.role})
          </span>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => {
            handleLogout();
          }}
        >
          Log out
        </button>
      </nav>
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}
