import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS } from '@shared/types/domain';
import { useTheme } from '../theme/ThemeProvider';
import { useSessionStore } from '../store/useSessionStore';
import { api } from '../api/client';
import { IconMenu, IconMoon, IconSun } from './icons';

/**
 * The Secretary area's own layout — deliberately separate from `AppLayout`
 * rather than a variant of it, since a Secretary account never sees any of
 * the normal scheduling nav (My Schedule, Time Off, Notice Board, etc.).
 * Reuses the exact same `.app-*` CSS classes as `AppLayout` for a
 * consistent look with zero new CSS, including the responsive
 * hamburger-menu breakpoint, even though there's only one real link here
 * today — later milestones (League picker, Setup, Roster, Weekly Entries,
 * Weekly Banking, Bowler/Season Summary) add more nav links into this same
 * shell without needing new responsive behavior.
 */
export function SecretaryLayout(): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const currentEmployee = useSessionStore((state) => state.currentEmployee);
  const setSession = useSessionStore((state) => state.setSession);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = (): void => setIsMenuOpen(false);

  const handleLogout = async (): Promise<void> => {
    await api.auth.logout();
    setSession(null);
    queryClient.clear();
    navigate('/secretary/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-nav-bar">
          <span className="app-nav-brand">
            <img className="app-nav-brand-mark" src="./icons/icon-192.png" alt="" aria-hidden="true" />
            Mt Hood Lanes — Secretary
          </span>
          <button
            type="button"
            className="app-nav-toggle"
            aria-expanded={isMenuOpen}
            aria-controls="secretary-nav-links"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <IconMenu />
          </button>
        </div>
        <div id="secretary-nav-links" className={isMenuOpen ? 'app-nav-links open' : 'app-nav-links'}>
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
          <div className="app-nav-account">
            {currentEmployee && (
              <span className="app-nav-user">
                {currentEmployee.name} ({ROLE_LABELS[currentEmployee.role]})
              </span>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => {
                closeMenu();
                handleLogout();
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </nav>
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}
