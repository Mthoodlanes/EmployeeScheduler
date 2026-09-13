import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
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
if (window.api) {
  document.body.classList.add('is-electron-shell');
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
