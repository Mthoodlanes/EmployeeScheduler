/**
 * Milestone 16: port of `src/main/services/preferenceService.ts` onto the new
 * Drizzle `preferenceRepo` (Milestone 15). This service already took a
 * `RequestingActor` in the original, so this is a mechanical async port —
 * `RequestingActor` now comes from the shared `server/src/db/domain-types.js`
 * mirror instead of being redeclared locally.
 */
import * as preferenceRepo from '../db/repositories/preferenceRepo.js';
import type { EmployeePreference, RequestingActor } from '../db/domain-types.js';

export type { RequestingActor };

export class PreferenceNotFoundError extends Error {
  constructor(id: number) {
    super(`Employee preference ${id} not found`);
    this.name = 'PreferenceNotFoundError';
  }
}

export class UnauthorizedPreferenceActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedPreferenceActionError';
  }
}

function assertManager(actor: RequestingActor): void {
  if (actor.role !== 'manager') {
    throw new UnauthorizedPreferenceActionError('Only managers can manage employee preferences');
  }
}

function assertValidWindow(preferredStartTime: string, preferredEndTime: string): void {
  if (!preferredStartTime || !preferredEndTime) {
    throw new Error('Both a preferred start and end time are required');
  }
  if (preferredEndTime <= preferredStartTime) {
    throw new Error('Preferred end time must be after the preferred start time');
  }
}

/** Any logged-in user may read preferences — the schedule grid needs them regardless of who is viewing it. */
export async function listAllPreferences(): Promise<EmployeePreference[]> {
  return preferenceRepo.listAll();
}

/** Any logged-in user may read one employee's preferences (used by the Employees admin page). */
export async function listPreferencesForEmployee(employeeId: number): Promise<EmployeePreference[]> {
  return preferenceRepo.listByEmployee(employeeId);
}

export interface CreatePreferenceInput {
  employeeId: number;
  dayOfWeek: number;
  preferredStartTime: string;
  preferredEndTime: string;
  note?: string | null;
}

/** Only a manager may add a preference window for an employee. */
export async function createPreference(
  actor: RequestingActor,
  input: CreatePreferenceInput,
): Promise<EmployeePreference> {
  assertManager(actor);
  assertValidWindow(input.preferredStartTime, input.preferredEndTime);
  return preferenceRepo.create(input);
}

export interface UpdatePreferenceInput {
  id: number;
  dayOfWeek: number;
  preferredStartTime: string;
  preferredEndTime: string;
  note?: string | null;
}

/** Only a manager may edit a preference window. */
export async function updatePreference(
  actor: RequestingActor,
  input: UpdatePreferenceInput,
): Promise<EmployeePreference> {
  assertManager(actor);
  assertValidWindow(input.preferredStartTime, input.preferredEndTime);

  const existing = await preferenceRepo.getById(input.id);
  if (!existing) {
    throw new PreferenceNotFoundError(input.id);
  }
  return preferenceRepo.update(input);
}

/** Only a manager may remove a preference window. */
export async function removePreference(actor: RequestingActor, id: number): Promise<void> {
  assertManager(actor);
  const existing = await preferenceRepo.getById(id);
  if (!existing) {
    throw new PreferenceNotFoundError(id);
  }
  await preferenceRepo.remove(id);
}
