import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS } from '@shared/types/domain';
import { useTheme } from '../theme/ThemeProvider';
import { useSessionStore } from '../store/useSessionStore';
import { useNoticesUnreadStatus } from '../hooks/useNotices';
import { api } from '../api/client';
import { IconMenu, IconMoon, IconSun } from './icons';
import { NoticeAlertToast } from './NoticeAlertToast';

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
  const { data: unreadStatus } = useNoticesUnreadStatus();
  // Only meaningful at the mobile breakpoint (see `.app-nav-links` in
  // styles.css) — the desktop nav ignores this and always shows every link,
  // since a manager's full link set (7 items) stacked one-per-row would
  // otherwise eat almost the entire phone viewport before any page content
  // is visible.
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = (): void => setIsMenuOpen(false);

  const handleLogout = async (): Promise<void> => {
    await api.auth.logout();
    setSession(null);
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-nav-bar">
          <span className="app-nav-brand">
            <img className="app-nav-brand-mark" src="./icons/icon-192.png" alt="" aria-hidden="true" />
            Mt Hood Lanes
          </span>
          <button
            type="button"
            className="app-nav-toggle"
            aria-expanded={isMenuOpen}
            aria-controls="app-nav-links"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <IconMenu />
          </button>
        </div>
        <div id="app-nav-links" className={isMenuOpen ? 'app-nav-links open' : 'app-nav-links'}>
          <NavLink to="/my-schedule" className={navLinkClassName} onClick={closeMenu}>
            My Schedule
          </NavLink>
          <NavLink to="/time-off/request" className={navLinkClassName} onClick={closeMenu}>
            Request Time Off
          </NavLink>
          {isManager && (
            <>
              <NavLink to="/time-off" end className={navLinkClassName} onClick={closeMenu}>
                Time Off Queue
              </NavLink>
              <NavLink to="/schedule" className={navLinkClassName} onClick={closeMenu}>
                Schedule Board
              </NavLink>
              <NavLink to="/employees" className={navLinkClassName} onClick={closeMenu}>
                Employees
              </NavLink>
              <NavLink to="/shift-templates" className={navLinkClassName} onClick={closeMenu}>
                Shift Templates
              </NavLink>
              <NavLink to="/store-hours" className={navLinkClassName} onClick={closeMenu}>
                Store Hours
              </NavLink>
            </>
          )}
          <NavLink to="/notices" className={navLinkClassName} onClick={closeMenu}>
            Notice Board
            {unreadStatus?.hasUnread && (
              <span className="app-nav-badge" data-testid="notice-board-unread-badge" />
            )}
          </NavLink>
          <span className="app-nav-spacer" />
          <NavLink to="/account" className={navLinkClassName} onClick={closeMenu}>
            My Account
          </NavLink>
          <NavLink to="/settings" className={navLinkClassName} onClick={closeMenu}>
            Settings
          </NavLink>
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
      </nav>
      <div className="app-content">
        <Outlet />
      </div>
      <NoticeAlertToast />
    </div>
  );
}
