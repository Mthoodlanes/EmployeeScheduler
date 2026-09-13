import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNoticesUnreadStatus } from '../hooks/useNotices';

/**
 * Milestone 26: a small dismissible toast shown once per authenticated
 * session when the notice board has something unread — the "alert the user"
 * half of the notice-board unread signal (see `AppLayout`'s nav badge for
 * the other half). Mounted inside `AppLayout`, which stays mounted for the
 * whole logged-in session (wraps every authenticated route's `<Outlet/>`),
 * so local `dismissed` state naturally persists across navigation without a
 * new toast reappearing on every page change — only a fresh login/reload
 * re-mounts this component and re-evaluates unread status from scratch.
 */
export function NoticeAlertToast(): React.JSX.Element | null {
  const { data } = useNoticesUnreadStatus();
  const [dismissed, setDismissed] = useState(false);

  if (!data?.hasUnread || dismissed) {
    return null;
  }

  return (
    <div className="notice-alert-toast" role="status" data-testid="notice-alert-toast">
      <span className="notice-alert-toast-message">A new notice has been posted.</span>
      <div className="notice-alert-toast-actions">
        <Link
          className="btn btn-primary notice-alert-toast-view"
          to="/notices"
          onClick={() => setDismissed(true)}
        >
          View
        </Link>
        <button
          type="button"
          className="btn-link"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notice alert"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
