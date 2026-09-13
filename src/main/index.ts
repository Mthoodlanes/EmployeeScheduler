import path from 'node:path';
import 'dotenv/config';
import { app, BrowserWindow, shell } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { IpcChannels } from '../shared/types/ipc';
import { registerIpc } from './ipc/registerIpc';

/**
 * The hosted site the shell loads (Milestone 23 — see the Phase 2 plan's
 * "Electron shell" architecture decision). Hardcoded default is the real
 * production site, so a normal/packaged install works with zero
 * configuration; override via a real environment variable or a `.env` file
 * at the project root (loaded the same way `server/src/index.ts` loads its
 * own env vars, via `dotenv/config`) for local development or testing
 * against a different deployment (e.g. a local `npm run server:dev`
 * instance or a staging URL).
 */
const APP_URL = process.env.APP_URL ?? 'https://mymthoodlanes.com';

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    // Custom title bar (Milestone 9): the OS title bar/frame is removed and
    // replaced by the in-app `TitleBar` component (drag region + custom
    // minimize/maximize/close buttons wired over IPC — see
    // src/main/ipc/windowControls.ipc.ts). `transparent: true` is required so
    // the renderer can visually round the window's corners with CSS (`#root`'s
    // `border-radius` + `overflow: hidden` in theme.css) — on Windows 10 (this
    // app's target), frameless windows are NOT rounded by the OS the way they
    // are on Windows 11, so this is done in userland. This is the same
    // frame:false + transparent + CSS-clip pattern shipped by VS Code, Slack
    // and Discord on Windows for the same reason. Content renders correctly
    // with no crashes/GPU errors across normal/maximized/resized states and
    // both themes (verified via a real Playwright Electron pass — see the
    // Milestone 9 report for what could/couldn't be captured in this dev
    // sandbox and the fallback if this ever needs revisiting).
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send(IpcChannels.windowControlsMaximizedChanged, true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send(IpcChannels.windowControlsMaximizedChanged, false);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Milestone 23: the shell is now just a native window around the hosted
  // site — no more dev-server-or-local-file branching, no local database to
  // initialize first.
  mainWindow.loadURL(APP_URL);
}

app
  .whenReady()
  .then(() => {
    electronApp.setAppUserModelId('com.mthoodlanes.scheduler');

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    registerIpc();

    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Fatal error during app startup:', err);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
