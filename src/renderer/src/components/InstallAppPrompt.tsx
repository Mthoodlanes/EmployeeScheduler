import { useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { IconDownload, IconShare } from './icons';

/**
 * Milestone 25: prompts a visitor to install the PWA — to a phone's home
 * screen, or to a desktop as its own app window.
 *
 * Three cases, in priority order:
 *  1. iOS Safari never fires `beforeinstallprompt` at all, so it gets
 *     static manual instructions — there is no programmatic install API
 *     on iOS.
 *  2. `canInstall` (a captured `beforeinstallprompt`) — a real, working
 *     "Install App" button on Android AND desktop Chrome/Edge alike (same
 *     event, same state); only the copy adapts via `isTouchPrimary`.
 *  3. Desktop Chrome/Edge with no captured prompt yet — Chrome only fires
 *     `beforeinstallprompt` once its own engagement heuristic is satisfied,
 *     which can take several visits. Rather than show nothing until then
 *     (unlike iOS, which always shows something), this keeps a persistent
 *     card visible and falls back to pointing at the browser's own manual
 *     install affordance. Scoped to touch-primary being false — mobile
 *     Chrome has no equivalent reliable manual path to describe.
 *
 * Renders nothing inside the Electron shell (`window.api` truthy — that's
 * already a native-ish install), once the PWA is already installed, or in a
 * browser with no install mechanism at all (Firefox, desktop Safari).
 */
export function InstallAppPrompt(): React.JSX.Element | null {
  const { canInstall, isIos, isTouchPrimary, isChromiumBased, isStandalone, promptInstall } =
    useInstallPrompt();
  const [showManualHelp, setShowManualHelp] = useState(false);

  if (window.api || isStandalone) {
    return null;
  }

  if (isIos) {
    return (
      <div className="install-app-prompt" data-testid="install-app-prompt-ios">
        <div className="install-app-prompt-row">
          <IconShare />
          <p>
            Install this app on your iPhone or iPad: tap <strong>Share</strong>, then{' '}
            <strong>Add to Home Screen</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (canInstall) {
    return (
      <div className="install-app-prompt" data-testid="install-app-prompt-installable">
        <p>
          {isTouchPrimary
            ? 'Install this app for quick access from your home screen.'
            : 'Install this app for quick access from your desktop.'}
        </p>
        <button
          type="button"
          className="btn"
          data-testid="install-app-button"
          onClick={() => {
            promptInstall();
          }}
        >
          <IconDownload /> Install App
        </button>
      </div>
    );
  }

  if (!isTouchPrimary && isChromiumBased) {
    return (
      <div className="install-app-prompt" data-testid="install-app-prompt-desktop-manual">
        <p>Install this app for quick access from your desktop.</p>
        <button
          type="button"
          className="btn"
          data-testid="install-app-button"
          onClick={() => setShowManualHelp((prev) => !prev)}
        >
          <IconDownload /> Install App
        </button>
        {showManualHelp && (
          <p className="install-app-prompt-help" data-testid="install-app-manual-help">
            Look for an install icon at the right edge of the address bar, or open the browser
            menu and choose <strong>Install Mt Hood Lanes Scheduler&hellip;</strong> (Chrome) or{' '}
            <strong>Apps &rarr; Install this site as an app</strong> (Edge).
          </p>
        )}
      </div>
    );
  }

  return null;
}
