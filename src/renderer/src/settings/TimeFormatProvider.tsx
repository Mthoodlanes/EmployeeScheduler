import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { TimeFormat } from '../utils/formatShiftTime';

interface TimeFormatContextValue {
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
}

const TimeFormatContext = createContext<TimeFormatContextValue | undefined>(undefined);
const STORAGE_KEY = 'mhl-time-format';

/**
 * Per-device display preference (like `ThemeProvider`'s theme), not a
 * per-account setting — nothing here is sent to the server. Defaults to
 * `'24h'` so every existing screen keeps showing exactly what it shows
 * today unless someone explicitly opts into 12-hour time in Settings.
 */
function getInitialTimeFormat(): TimeFormat {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === '24h' || stored === '12h') {
      return stored;
    }
  } catch {
    // localStorage unavailable (e.g. restrictive environment) — fall through.
  }
  return '24h';
}

export function TimeFormatProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(getInitialTimeFormat);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, timeFormat);
    } catch {
      // Ignore write failures; the preference just won't persist across launches.
    }
  }, [timeFormat]);

  const value = useMemo<TimeFormatContextValue>(() => ({ timeFormat, setTimeFormat }), [timeFormat]);

  return <TimeFormatContext.Provider value={value}>{children}</TimeFormatContext.Provider>;
}

export function useTimeFormat(): TimeFormatContextValue {
  const ctx = useContext(TimeFormatContext);
  if (!ctx) {
    throw new Error('useTimeFormat must be used within a TimeFormatProvider');
  }
  return ctx;
}
