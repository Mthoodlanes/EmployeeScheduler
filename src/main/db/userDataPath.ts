import path from 'node:path';
import os from 'node:os';

/**
 * The app name Electron uses to derive the default `userData` directory
 * (taken from package.json `name`, matching electron-builder's productName
 * derivation for this project).
 */
const APP_NAME = 'mt-hood-lanes-scheduler';

/**
 * Replicates Electron's default `app.getPath('userData')` resolution for
 * contexts that run under plain Node rather than the Electron runtime (the
 * `npm run seed` script, Vitest). The real main process should prefer
 * `app.getPath('userData')` directly; this helper exists purely so
 * out-of-Electron tooling points at the same database file.
 */
export function getDefaultUserDataDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, APP_NAME);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  }
  return path.join(os.homedir(), '.config', APP_NAME);
}

export function getDefaultDbPath(): string {
  return path.join(getDefaultUserDataDir(), 'app.db');
}
