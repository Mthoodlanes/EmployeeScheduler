import { useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { IconDownload, IconShare } from './icons';

/**
 * Copies the current URL to the clipboard — the practical hand-off for
 * "open this page in Safari instead" on iOS: someone reading this prompt
 * inside Chrome/Brave/etc. would otherwise have to retype the URL from
 * memory once they switch apps.
 */
function CopyLinkButton(): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-link"
      data-testid="install-app-copy-link"
      onClick={() => {
        // `navigator.clipboard` itself can be undefined (older browser, a
        // non-secure-context edge case) rather than just rejecting, so this
        // needs a try/catch around the whole call, not just a `.catch()` on
        // the promise it returns.
        try {
          navigator.clipboard
            ?.writeText(window.location.href)
            .then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => {
              // Denied (e.g. no clipboard permission) — the URL is still
              // visible in the address bar for manual copying.
            });
        } catch {
          // Unavailable entirely — same fallback as above.
        }
      }}
    >
      {copied ? 'Copied!' : 'Copy Link'}
    </button>
  );
}

/** The manual-install help text for a Chromium-family browser once `showManualHelp` is toggled on — its own function to keep the three cases as an if/else chain rather than a nested ternary. */
function chromiumManualHelp(isSamsungInternet: boolean, isTouchPrimary: boolean): React.JSX.Element {
  if (isSamsungInternet) {
    return (
      <>
        Look for a <strong>+</strong> or download icon in the address bar, or open the menu and
        choose <strong>Add page to</strong> → <strong>Home screen</strong>.
      </>
    );
  }
  if (isTouchPrimary) {
    return (
      <>
        Tap the menu button (&#8942;) at the top right, then choose{' '}
        <strong>Add to Home screen</strong> or <strong>Install app</strong>.
      </>
    );
  }
  return (
    <>
      Look for an install icon at the right edge of the address bar, or open the browser menu and
      choose <strong>Install Mt Hood Lanes Scheduler&hellip;</strong> (Chrome) or{' '}
      <strong>Apps &rarr; Install this site as an app</strong> (Edge).
    </>
  );
}

/**
 * Milestone 25: prompts a visitor to install the PWA — to a phone's home
 * screen, or to a desktop as its own app window.
 *
 * Six cases, in priority order:
 *  1. iOS Safari (genuinely Safari, not another browser wearing its
 *     engine) never fires `beforeinstallprompt` at all, so it gets static
 *     manual instructions — there is no programmatic install API on iOS.
 *  2. iOS in any OTHER browser (`isNonSafariIos` — Chrome, Firefox, Edge,
 *     Opera, or Brave specifically) — none of them reproduce Safari's
 *     Share-sheet "Add to Home Screen" flow reliably (Brave doesn't have
 *     it at all — confirmed live), so this points the visitor at Safari
 *     itself instead, with a Copy Link button so they don't have to retype
 *     the URL from memory after switching apps.
 *  3. `canInstall` (a captured `beforeinstallprompt`) — a real, working
 *     "Install App" button on Android AND desktop Chrome/Edge alike (same
 *     event, same state); only the copy adapts via `isTouchPrimary`.
 *  4. Android Firefox — never fires `beforeinstallprompt` (Firefox never
 *     implemented it), but has a real, working "Install"/"Add to Home
 *     screen" item in its own menu, worth a dedicated instruction rather
 *     than lumping it in with Chromium's differently-worded menu.
 *  5 & 6. Chrome/Edge/Samsung Internet (desktop or Android) with no
 *     captured prompt yet — Chrome only fires `beforeinstallprompt` once
 *     its own engagement heuristic is satisfied (return visits, time on
 *     site), which can take several visits on EITHER platform. Rather than
 *     show nothing until then (unlike iOS, which always shows something),
 *     this keeps a persistent card visible and falls back to pointing at
 *     the browser's own manual install affordance — confirmed live: an
 *     employee on Android Chrome saw no install option at all in this gap,
 *     since an earlier version of this component only had a manual
 *     fallback for desktop. Samsung Internet gets its own wording here
 *     too, since its menu ("Add page to" -> "Home screen") reads nothing
 *     like Chrome's.
 *
 * Renders nothing inside the Electron shell (`window.api` truthy — that's
 * already a native-ish install), once the PWA is already installed, or on
 * desktop Firefox, which has no install feature at all in its standard
 * release. Anything else genuinely unrecognized falls through to a last
 * line rather than showing nothing at all.
 */
export function InstallAppPrompt(): React.JSX.Element | null {
  const {
    canInstall,
    isIos,
    isNonSafariIos,
    isTouchPrimary,
    isChromiumBased,
    isFirefox,
    isSamsungInternet,
    isBrave,
    isStandalone,
    promptInstall,
  } = useInstallPrompt();
  const [showManualHelp, setShowManualHelp] = useState(false);

  if (window.api || isStandalone) {
    return null;
  }

  if (isIos && !isNonSafariIos) {
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

  if (isIos && isNonSafariIos) {
    return (
      <div className="install-app-prompt" data-testid="install-app-prompt-ios-non-safari">
        <div className="install-app-prompt-row">
          <IconShare />
          <p>
            {isBrave
              ? "Brave doesn't support installing apps on iPhone or iPad."
              : 'For a proper install on iPhone or iPad, use Safari.'}{' '}
            Open this page in Safari, then tap <strong>Share</strong> →{' '}
            <strong>Add to Home Screen</strong>.
          </p>
        </div>
        <CopyLinkButton />
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
            {chromiumManualHelp(isSamsungInternet, isTouchPrimary)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="install-app-prompt" data-testid="install-app-prompt-unsupported">
      <p>Having trouble installing this app? Tell Jesse to do better.</p>
    </div>
  );
}
