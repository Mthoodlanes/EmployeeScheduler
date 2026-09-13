import type { Employee } from '../shared/types/domain';

/**
 * In-memory current-session singleton for the main process. This is the
 * single source of truth for "who is logged in" — the renderer must never
 * be trusted to assert its own role; every privileged IPC handler re-checks
 * `session.getCurrent()` itself.
 */
let currentEmployee: Employee | null = null;

export const session = {
  login(employee: Employee): void {
    currentEmployee = employee;
  },
  logout(): void {
    currentEmployee = null;
  },
  getCurrent(): Employee | null {
    return currentEmployee;
  },
};
