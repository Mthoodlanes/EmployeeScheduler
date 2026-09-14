import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { IconDownload, IconShare } from './icons';

/**
 * Milestone 25: prompts a visitor to install the PWA — to a phone's home
 * screen, or to a desktop as its own app window. Android AND desktop
 * Chrome/Edge fire the exact same `beforeinstallprompt` event (see
 * `useInstallPrompt`) for this one button; only the copy below adapts to
 * `isTouchPrimary` so a desktop visitor isn't told about a "home screen"
 * they don't have. iOS Safari never fires that event at all, so it gets
 * static manual instructions instead — there is no programmatic install API
 * on iOS. Renders nothing inside the Electron shell (`window.api` truthy —
 * that's already a native-ish install) or once the PWA is already
 * installed.
 */
export function InstallAppPrompt(): React.JSX.Element | null {
  const { canInstall, isIos, isTouchPrimary, isStandalone, promptInstall } = useInstallPrompt();

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

  return null;
}
