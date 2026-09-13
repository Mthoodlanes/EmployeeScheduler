import type { IpcResult } from '../../shared/types/ipc';

/** Wraps a handler body, converting thrown errors into an `{ ok: false }` envelope. */
export async function toIpcResult<T>(fn: () => T | Promise<T>): Promise<IpcResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
