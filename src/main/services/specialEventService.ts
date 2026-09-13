import * as specialEventRepo from '../db/repositories/specialEventRepo';
import type { Role, SpecialEventOverride } from '../../shared/types/domain';

export class SpecialEventNotFoundError extends Error {
  constructor(id: number) {
    super(`Special event override ${id} not found`);
    this.name = 'SpecialEventNotFoundError';
  }
}

export class UnauthorizedSpecialEventActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedSpecialEventActionError';
  }
}

/**
 * The employee performing the action, established by the main-process
 * session — mirrors the actor pattern used by `preferenceService`/
 * `storeHoursService`. Special events are manager-set only, so every write
 * below re-checks `actor.role === 'manager'`; reads are open to any
 * logged-in user, since the schedule board needs them regardless of who is
 * viewing it.
 */
export interface RequestingActor {
  id: number;
  role: Role;
}

function assertManager(actor: RequestingActor): void {
  if (actor.role !== 'manager') {
    throw new UnauthorizedSpecialEventActionError(
      'Only managers can manage special event overrides',
    );
  }
}

function assertValidEvent(
  label: string,
  isClosed: boolean,
  openTime: string | null,
  closeTime: string | null,
): void {
  if (!label || !label.trim()) {
    throw new Error('A label is required for a special event override');
  }
  if (isClosed) {
    return;
  }
  if (!openTime || !closeTime) {
    throw new Error(
      'Both an open and close time are required unless the day is marked fully closed',
    );
  }
  // A close time at/before the open time is allowed — it's the app's
  // convention for "closes at/after midnight" (see storeHoursService and
  // shiftMath.ts's midnight-crossing handling), which a special event (e.g.
  // extending league-night hours past midnight) can legitimately need too.
  // Only an identical open/close time is rejected as ambiguous.
  if (closeTime === openTime) {
    throw new Error('Open and close time cannot be identical');
  }
}

/** Any logged-in user may read special events — the schedule board needs this regardless of who is viewing it. */
export function listSpecialEvents(): SpecialEventOverride[] {
  return specialEventRepo.listAll();
}

export interface CreateSpecialEventInput {
  eventDate: string;
  label: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

/** Only a manager may add a one-off date override; each date may have at most one. */
export function createSpecialEvent(
  actor: RequestingActor,
  input: CreateSpecialEventInput,
): SpecialEventOverride {
  assertManager(actor);
  assertValidEvent(input.label, input.isClosed, input.openTime, input.closeTime);
  if (specialEventRepo.getByDate(input.eventDate)) {
    throw new Error(`A special event override already exists for ${input.eventDate}`);
  }
  return specialEventRepo.create(input);
}

export interface UpdateSpecialEventInput {
  id: number;
  eventDate: string;
  label: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

/** Only a manager may edit an override. */
export function updateSpecialEvent(
  actor: RequestingActor,
  input: UpdateSpecialEventInput,
): SpecialEventOverride {
  assertManager(actor);
  assertValidEvent(input.label, input.isClosed, input.openTime, input.closeTime);

  const existing = specialEventRepo.getById(input.id);
  if (!existing) {
    throw new SpecialEventNotFoundError(input.id);
  }

  const dateOwner = specialEventRepo.getByDate(input.eventDate);
  if (dateOwner && dateOwner.id !== input.id) {
    throw new Error(`A special event override already exists for ${input.eventDate}`);
  }

  return specialEventRepo.update(input);
}

/** Only a manager may remove an override. */
export function removeSpecialEvent(actor: RequestingActor, id: number): void {
  assertManager(actor);
  const existing = specialEventRepo.getById(id);
  if (!existing) {
    throw new SpecialEventNotFoundError(id);
  }
  specialEventRepo.remove(id);
}
