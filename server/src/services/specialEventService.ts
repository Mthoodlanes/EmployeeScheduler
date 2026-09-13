/**
 * Milestone 16: port of `src/main/services/specialEventService.ts` onto the
 * new Drizzle `specialEventRepo` (Milestone 15). This service already took a
 * `RequestingActor` in the original, so this is a mechanical async port —
 * `RequestingActor` now comes from the shared `server/src/db/domain-types.js`
 * mirror instead of being redeclared locally.
 */
import * as specialEventRepo from '../db/repositories/specialEventRepo.js';
import type { RequestingActor, SpecialEventOverride } from '../db/domain-types.js';

export type { RequestingActor };

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
export async function listSpecialEvents(): Promise<SpecialEventOverride[]> {
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
export async function createSpecialEvent(
  actor: RequestingActor,
  input: CreateSpecialEventInput,
): Promise<SpecialEventOverride> {
  assertManager(actor);
  assertValidEvent(input.label, input.isClosed, input.openTime, input.closeTime);
  if (await specialEventRepo.getByDate(input.eventDate)) {
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
export async function updateSpecialEvent(
  actor: RequestingActor,
  input: UpdateSpecialEventInput,
): Promise<SpecialEventOverride> {
  assertManager(actor);
  assertValidEvent(input.label, input.isClosed, input.openTime, input.closeTime);

  const existing = await specialEventRepo.getById(input.id);
  if (!existing) {
    throw new SpecialEventNotFoundError(input.id);
  }

  const dateOwner = await specialEventRepo.getByDate(input.eventDate);
  if (dateOwner && dateOwner.id !== input.id) {
    throw new Error(`A special event override already exists for ${input.eventDate}`);
  }

  return specialEventRepo.update(input);
}

/** Only a manager may remove an override. */
export async function removeSpecialEvent(actor: RequestingActor, id: number): Promise<void> {
  assertManager(actor);
  const existing = await specialEventRepo.getById(id);
  if (!existing) {
    throw new SpecialEventNotFoundError(id);
  }
  await specialEventRepo.remove(id);
}
