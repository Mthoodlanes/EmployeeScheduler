import { InstallAppPrompt } from '../components/InstallAppPrompt';
import type { TimeFormat } from '../utils/formatShiftTime';
import { useTimeFormat } from '../settings/TimeFormatProvider';
import { usePushNotifications } from '../hooks/usePushNotifications';

/**
 * Notification opt-in — hidden entirely inside the Electron shell (no
 * service worker is ever registered there, see `main.tsx`, so Web Push
 * structurally cannot work) and on any browser/device that can't support
 * it. See `usePushNotifications` for the iOS-must-be-installed-first case.
 */
function NotificationsSection(): React.JSX.Element | null {
  const { supportState, isSubscribed, isLoading, error, subscribe, unsubscribe } =
    usePushNotifications();

  if (window.api || supportState === 'unsupported') {
    return null;
  }

  return (
    <div className="card section">
      <h2>Notifications</h2>
      {supportState === 'ios-not-installed' && (
        <p className="modal-subtitle">
          To get a notification on your iPhone or iPad when a new schedule is published, first
          install this app to your home screen (see above), then come back to this page.
        </p>
      )}
      {supportState === 'supported' && (
        <>
          <p className="modal-subtitle">
            Get a notification on this device as soon as a manager publishes a new schedule.
            Doesn&rsquo;t notify you about schedules published before you turned this on.
          </p>
          {isSubscribed === true && (
            <button
              type="button"
              className="btn btn-toggle active"
              data-testid="notifications-disable"
              disabled={isLoading}
              onClick={() => unsubscribe()}
            >
              {isLoading ? 'Turning off…' : 'Turn off schedule notifications'}
            </button>
          )}
          {isSubscribed === false && (
            <button
              type="button"
              className="btn"
              data-testid="notifications-enable"
              disabled={isLoading}
              onClick={() => subscribe()}
            >
              {isLoading ? 'Turning on…' : 'Enable schedule notifications'}
            </button>
          )}
          {error && (
            <p className="form-error" data-testid="notifications-error">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Per-device display preferences, reachable by any logged-in user (like
 * `MyAccountPage`, not gated behind `RequireManager`) — these affect how
 * THIS browser/device shows times, not anything stored on the account, so
 * there's no reason to restrict who can change them.
 */
export function SettingsPage(): React.JSX.Element {
  const { timeFormat, setTimeFormat } = useTimeFormat();

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <InstallAppPrompt />

      <NotificationsSection />

      <div className="card section">
        <h2>Time Format</h2>
        <p className="modal-subtitle">
          Controls how shift and store-hours times are displayed throughout the app on this
          device. Fixed times you type (in a shift template, custom shift, or store hours) still
          use your browser&rsquo;s own time picker either way.
        </p>
        <div className="form-rows">
          <label className="form-row" htmlFor="settings-time-format">
            <span className="form-row-label">Clock style</span>
            <select
              id="settings-time-format"
              className="text-input"
              data-testid="settings-time-format"
              value={timeFormat}
              onChange={(event) => setTimeFormat(event.target.value as TimeFormat)}
            >
              <option value="24h">24-hour (military time) — e.g. 14:00</option>
              <option value="12h">12-hour — e.g. 2:00 PM</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
