/**
 * Milestone 16: the two original `scheduledShiftService` error classes
 * (unchanged from `src/main/services/scheduledShiftService.ts`), split into
 * their own module purely to satisfy the repo's `max-classes-per-file: 2`
 * lint rule — this milestone's actor-param retrofit adds a 3rd class,
 * `UnauthorizedScheduledShiftActionError` (declared directly in
 * `scheduledShiftService.ts`, alongside its 8 sibling services' own
 * `Unauthorized*ActionError`), which would push a single file over that
 * limit. Re-exported from `scheduledShiftService.ts` so callers still import
 * everything from the service module as usual.
 */

export class ShiftTemplateNotFoundError extends Error {
  constructor(id: number) {
    super(`Shift template ${id} not found`);
    this.name = 'ShiftTemplateNotFoundError';
  }
}

export class DepartmentMismatchError extends Error {
  constructor() {
    super('That shift template does not belong to the requested department');
    this.name = 'DepartmentMismatchError';
  }
}
