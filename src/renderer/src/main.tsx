import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { initPwaUpdate } from './pwa/pwaUpdate';
import { App } from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import { queryClient } from './api/queryClient';
import './theme/theme.css';
import './styles.css';
import './components/ScheduleGrid/ScheduleGrid.css';
import './components/PrintSchedule/PrintSchedule.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

// `window.api` is only ever injected by the Electron preload script — its
// presence means this bundle is running inside the frameless desktop shell,
// which wants the transparent-window + rounded-#root-corners treatment (see
// theme.css). A plain web page/PWA has no window frame to fake and should
// just fill the viewport normally, not clip its own corners.
const isElectronShell = Boolean(window.api);
if (isElectronShell) {
  document.body.classList.add('is-electron-shell');
}

// Milestone 21 (PWA): register the Workbox service worker only on the real
// web/PWA path, never inside the Electron shell. `injectRegister: false` in
// electron.vite.config.ts's VitePWA options means this is the only place
// registration happens. Registering unconditionally would likely be
// harmless in Electron too (a packaged app loads index.html via `file://`,
// where service worker registration is rejected outright since it isn't a
// secure-context origin — see MDN's service worker security requirements —
// and even in `electron-vite dev`, which loads a real `http://localhost`
// origin, `vite-plugin-pwa` doesn't emit a real `sw.js` in dev mode, so the
// registration would just fail). But "likely harmless" isn't the same as
// "clearly correct": a native desktop shell registering a network-cache
// proxy for itself is surprising behavior with no upside, so it's skipped
// explicitly via the same `window.api` feature-detect used above, rather
// than left to fail quietly on its own.
//
// Milestone 23 (PWA update UX): registration itself, plus the "is a new
// version already active in the background?" state, now lives in
// pwa/pwaUpdate.ts (see that file for the update-propagation fix and the
// periodic update-check strategy) so `UpdateAvailableToast` — rendered near
// the root in App.tsx — can react to it without a forced page reload.
if (!isElectronShell) {
  initPwaUpdate();
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
