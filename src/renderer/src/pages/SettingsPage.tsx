import { InstallAppPrompt } from '../components/InstallAppPrompt';
import type { TimeFormat } from '../utils/formatShiftTime';
import { useTimeFormat } from '../settings/TimeFormatProvider';

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
