import { useSyncExternalStore } from 'react';
import {
  applyPwaUpdate,
  dismissPwaUpdate,
  getPwaUpdateSnapshot,
  subscribePwaUpdate,
} from '../pwa/pwaUpdate';

/**
 * Small, dismissible banner shown on the web/PWA build when a new deployed
 * version's service worker has taken over in the background (see
 * `src/renderer/src/pwa/pwaUpdate.ts`). Renders nothing until then, and
 * renders nothing at all inside the Electron desktop shell — `initPwaUpdate`
 * (called from main.tsx behind the existing `!isElectronShell` guard) is the
 * only thing that can ever flip `needRefresh` to true, so mounting this
 * unconditionally near the root is safe: in Electron the underlying store
 * simply never changes state.
 *
 * Deliberately does NOT reload the page on its own — see the module doc in
 * pwaUpdate.ts for why an automatic reload would be the wrong call here.
 */
export function UpdateAvailableToast(): React.JSX.Element | null {
  const { needRefresh } = useSyncExternalStore(subscribePwaUpdate, getPwaUpdateSnapshot);

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="pwa-update-toast" role="status" data-testid="pwa-update-toast">
      <span className="pwa-update-toast-message">A new version is available.</span>
      <div className="pwa-update-toast-actions">
        <button
          type="button"
          className="btn btn-primary pwa-update-toast-refresh"
          onClick={applyPwaUpdate}
        >
          Refresh
        </button>
        <button
          type="button"
          className="btn-link"
          onClick={dismissPwaUpdate}
          aria-label="Dismiss update notification"
        >
          Later
        </button>
      </div>
    </div>
  );
}
