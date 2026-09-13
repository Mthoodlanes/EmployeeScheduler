import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { IconDownload, IconShare } from './icons';

/**
 * Milestone 25: prompts a visitor to install the PWA to their phone's home
 * screen. Android/desktop Chrome support a real native install prompt via
 * `beforeinstallprompt` (see `useInstallPrompt`); iOS Safari never fires that
 * event at all, so it gets static manual instructions instead — there is no
 * programmatic install API on iOS. Renders nothing inside the Electron shell
 * (`window.api` truthy — that's already a native-ish install, "add to home
 * screen" doesn't apply) or once the PWA is already installed.
 */
export function InstallAppPrompt(): React.JSX.Element | null {
  const { canInstall, isIos, isStandalone, promptInstall } = useInstallPrompt();

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
      <div className="install-app-prompt" data-testid="install-app-prompt-android">
        <p>Install this app for quick access from your home screen.</p>
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
