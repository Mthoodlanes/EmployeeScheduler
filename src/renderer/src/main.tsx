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

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
