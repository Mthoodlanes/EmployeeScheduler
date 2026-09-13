import * as preferenceRepo from '../db/repositories/preferenceRepo';
import type { EmployeePreference, Role } from '../../shared/types/domain';

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

/**
 * The employee performing the action, established by the main-process
 * session (never trust a renderer-supplied id/role) — mirrors the actor
 * pattern introduced by `timeOffService`. Preferences are manager-entered
 * only (there is no "own preference" self-service case), so every write
 * below re-checks `actor.role === 'manager'`; reads are open to any
 * logged-in user, consistent with how schedule/time-off reads work.
 */
export interface RequestingActor {
  id: number;
  role: Role;
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
export function listAllPreferences(): EmployeePreference[] {
  return preferenceRepo.listAll();
}

/** Any logged-in user may read one employee's preferences (used by the Employees admin page). */
export function listPreferencesForEmployee(employeeId: number): EmployeePreference[] {
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
export function createPreference(
  actor: RequestingActor,
  input: CreatePreferenceInput,
): EmployeePreference {
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
export function updatePreference(
  actor: RequestingActor,
  input: UpdatePreferenceInput,
): EmployeePreference {
  assertManager(actor);
  assertValidWindow(input.preferredStartTime, input.preferredEndTime);

  const existing = preferenceRepo.getById(input.id);
  if (!existing) {
    throw new PreferenceNotFoundError(input.id);
  }
  return preferenceRepo.update(input);
}

/** Only a manager may remove a preference window. */
export function removePreference(actor: RequestingActor, id: number): void {
  assertManager(actor);
  const existing = preferenceRepo.getById(id);
  if (!existing) {
    throw new PreferenceNotFoundError(id);
  }
  preferenceRepo.remove(id);
}
