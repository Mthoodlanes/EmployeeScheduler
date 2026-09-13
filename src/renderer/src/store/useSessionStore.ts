import { create } from 'zustand';
import type { Employee } from '@shared/types/domain';

interface SessionState {
  currentEmployee: Employee | null;
  isFirstRun: boolean;
  isInitializing: boolean;
  setSession: (employee: Employee | null) => void;
  setFirstRun: (isFirstRun: boolean) => void;
  setInitializing: (value: boolean) => void;
}

/** Client-side mirror of the main-process session, refreshed via IPC on load/login/logout. */
export const useSessionStore = create<SessionState>((set) => ({
  currentEmployee: null,
  isFirstRun: false,
  isInitializing: true,
  setSession: (employee) => set({ currentEmployee: employee }),
  setFirstRun: (isFirstRun) => set({ isFirstRun }),
  setInitializing: (value) => set({ isInitializing: value }),
}));
