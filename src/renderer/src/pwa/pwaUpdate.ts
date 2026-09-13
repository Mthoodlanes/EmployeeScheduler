import { registerSW } from 'virtual:pwa-register';

/**
 * Milestone 23 (PWA update UX): registers the Workbox service worker on the
 * web/PWA path and exposes a tiny external store so `UpdateAvailableToast`
 * can react to it, without forcing the reload itself.
 *
 * Why this exists instead of calling `registerSW()` directly in main.tsx
 * (which is all Milestone 21 originally did): `electron.vite.config.ts` now
 * sets `registerType: 'autoUpdate'` *and* `workbox.skipWaiting` /
 * `clientsClaim`, so a new service worker installs, activates, and takes
 * control of already-open tabs immediately — no more waiting for every tab
 * to close. But vite-plugin-pwa's own `virtual:pwa-register` client script
 * has a subtlety worth spelling out: in "autoUpdate" mode, the relevant
 * callback is `onNeedReload` (fired on the Workbox `activated` event), NOT
 * `onNeedRefresh` (which only exists for the `prompt`/manual mode this app
 * does not use). If `onNeedReload` is left unset, the library's own default
 * is to silently call `window.location.reload()` the instant the new SW
 * activates — precisely the yank-the-rug-out behavior the business owner
 * asked us to avoid. So `onNeedReload` here does the minimum needed to stay
 * non-disruptive: flip a flag the toast can observe, and let the human
 * decide when to reload.
 */

interface PwaUpdateState {
  needRefresh: boolean;
  offlineReady: boolean;
}

type Listener = () => void;

let state: PwaUpdateState = { needRefresh: false, offlineReady: false };
const listeners = new Set<Listener>();

function setState(patch: Partial<PwaUpdateState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

/** For `useSyncExternalStore` in `UpdateAvailableToast`. */
export function subscribePwaUpdate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaUpdateSnapshot(): PwaUpdateState {
  return state;
}

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

// The browser only checks for a new service-worker script on navigation, but
// this is a single-page app (HashRouter) that a manager may reasonably leave
// open — the Schedule Board in particular — for an entire shift without ever
// triggering a real navigation. Two cheap, low-overhead triggers cover that:
//
//  1. An interval, generously long at 45 minutes. This app deploys at most a
//     handful of times a day, so anything shorter just burns a HEAD-sized
//     request against sw.js for no real gain in responsiveness; 45 minutes
//     comfortably beats "checked at least a couple of times per shift"
//     without ever feeling like polling.
//  2. `visibilitychange` → visible again. This is what actually catches the
//     common real-world case cheaply: a manager's laptop was asleep, or the
//     tab sat backgrounded overnight, and they come back to it the next
//     morning — we don't want them to wait up to 45 minutes for that.
//
// Neither path does anything disruptive by itself: `registration.update()`
// only ever fetches sw.js and lets Workbox's own install/activate lifecycle
// (skipWaiting + clientsClaim, configured in electron.vite.config.ts) decide
// whether anything changed. The actual UI reaction still goes through
// `onNeedReload` below.
const UPDATE_CHECK_INTERVAL_MS = 45 * 60 * 1000;

function checkForUpdate(): void {
  swRegistration?.update().catch(() => {
    // Best-effort only — a failed background update check (e.g. offline)
    // isn't worth surfacing to the user.
  });
}

let initialized = false;

/**
 * Call once, only on the real web/PWA path (never inside the Electron
 * shell — see the `!isElectronShell` guard in main.tsx). Safe to call at
 * most once; a second call is a no-op.
 */
export function initPwaUpdate(): void {
  if (initialized) return;
  initialized = true;

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedReload: () => {
      setState({ needRefresh: true });
    },
    onOfflineReady: () => {
      setState({ offlineReady: true });
    },
    onRegisteredSW: (_swUrl, registration) => {
      swRegistration = registration ?? null;
    },
    onRegisterError: (error) => {
      console.error('[pwa] service worker registration failed', error);
    },
  });

  window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdate();
    }
  });
}

/**
 * Called by the toast's "Refresh" button. Activates the waiting service
 * worker (a no-op in practice here, since `skipWaiting`/`clientsClaim` mean
 * it's typically already in control by the time the user sees the toast)
 * and then reloads the page — the explicit, user-initiated version of the
 * reload that `onNeedReload` above deliberately declined to do
 * automatically.
 */
export function applyPwaUpdate(): void {
  (updateServiceWorker?.(false) ?? Promise.resolve()).finally(() => {
    window.location.reload();
  });
}

/**
 * Called by the toast's dismiss/"later" button. This only hides the
 * notification — it does not cancel or undo the update. The new service
 * worker is (per `skipWaiting`/`clientsClaim`) already active and in control,
 * so the new version is picked up automatically the next time the user
 * refreshes or navigates in a way that reloads the page.
 */
export function dismissPwaUpdate(): void {
  setState({ needRefresh: false });
}
