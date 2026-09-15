import { useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { IconDownload, IconShare } from './icons';

/**
 * Milestone 25: prompts a visitor to install the PWA — to a phone's home
 * screen, or to a desktop as its own app window.
 *
 * Five cases, in priority order:
 *  1. iOS Safari never fires `beforeinstallprompt` at all, so it gets
 *     static manual instructions — there is no programmatic install API
 *     on iOS. Also catches Firefox/Chrome-on-iOS, which are Safari
 *     underneath (Apple mandates WebKit for every iOS browser) and share
 *     the exact same Share-sheet install path.
 *  2. `canInstall` (a captured `beforeinstallprompt`) — a real, working
 *     "Install App" button on Android AND desktop Chrome/Edge alike (same
 *     event, same state); only the copy adapts via `isTouchPrimary`.
 *  3. Android Firefox — never fires `beforeinstallprompt` (Firefox never
 *     implemented it), but has a real, working "Install"/"Add to Home
 *     screen" item in its own menu, worth a dedicated instruction rather
 *     than lumping it in with Chromium's differently-worded menu.
 *  4 & 5. Chrome/Edge (desktop or Android) with no captured prompt yet —
 *     Chrome only fires `beforeinstallprompt` once its own engagement
 *     heuristic is satisfied (return visits, time on site), which can take
 *     several visits on EITHER platform. Rather than show nothing until
 *     then (unlike iOS, which always shows something), this keeps a
 *     persistent card visible and falls back to pointing at the browser's
 *     own manual install affordance — confirmed live: an employee on
 *     Android Chrome saw no install option at all in this gap, since an
 *     earlier version of this component only had a manual fallback for
 *     desktop.
 *
 * Renders nothing inside the Electron shell (`window.api` truthy — that's
 * already a native-ish install), once the PWA is already installed, or on
 * desktop Firefox, which has no install feature at all in its standard
 * release — there's nothing accurate to tell that visitor to click.
 */
export function InstallAppPrompt(): React.JSX.Element | null {
  const {
    canInstall,
    isIos,
    isTouchPrimary,
    isChromiumBased,
    isFirefox,
    isStandalone,
    promptInstall,
  } = useInstallPrompt();
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

  if (isFirefox && isTouchPrimary) {
    return (
      <div className="install-app-prompt" data-testid="install-app-prompt-firefox-manual">
        <p>Install this app for quick access from your home screen.</p>
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
            Tap the menu button (&#8942;) at the top right, then choose{' '}
            <strong>Install</strong> (or <strong>Add to Home screen</strong> on older versions of
            Firefox).
          </p>
        )}
      </div>
    );
  }

  if (isChromiumBased) {
    return (
      <div className="install-app-prompt" data-testid="install-app-prompt-manual">
        <p>
          {isTouchPrimary
            ? 'Install this app for quick access from your home screen.'
            : 'Install this app for quick access from your desktop.'}
        </p>
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
            {isTouchPrimary ? (
              <>
                Tap the menu button (&#8942;) at the top right, then choose{' '}
                <strong>Add to Home screen</strong> or <strong>Install app</strong>.
              </>
            ) : (
              <>
                Look for an install icon at the right edge of the address bar, or open the browser
                menu and choose <strong>Install Mt Hood Lanes Scheduler&hellip;</strong> (Chrome) or{' '}
                <strong>Apps &rarr; Install this site as an app</strong> (Edge).
              </>
            )}
          </p>
        )}
      </div>
    );
  }

  return null;
}
