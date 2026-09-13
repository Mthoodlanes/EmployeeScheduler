import * as storeHoursRepo from '../db/repositories/storeHoursRepo';
import type { Role, StoreHours } from '../../shared/types/domain';

export class UnauthorizedStoreHoursActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedStoreHoursActionError';
  }
}

/**
 * The employee performing the action, established by the main-process
 * session (never trust a renderer-supplied id/role) — mirrors the actor
 * pattern used by `preferenceService`. Store hours are manager-set only, so
 * every write below re-checks `actor.role === 'manager'`; reads are open to
 * any logged-in user, since the schedule board needs them regardless of who
 * is viewing it.
 */
export interface RequestingActor {
  id: number;
  role: Role;
}

function assertManager(actor: RequestingActor): void {
  if (actor.role !== 'manager') {
    throw new UnauthorizedStoreHoursActionError('Only managers can manage store hours');
  }
}

/**
 * A close time less than or equal to the open time is NOT rejected — it's
 * the app's convention for "closes at/after midnight" (e.g. "14:00"-"00:00"
 * on the real Mt Hood Lanes Wednesday/Friday/Saturday hours), consistently
 * handled as crossing into the next calendar day by `shiftMath.ts`/
 * `hoursResolution.ts`. Only an identical open and close time is rejected,
 * since that can't distinguish "closed" from "open 24 hours" and is never a
 * real store-hours input.
 */
function assertValidHours(
  isClosed: boolean,
  openTime: string | null,
  closeTime: string | null,
): void {
  if (isClosed) {
    return;
  }
  if (!openTime || !closeTime) {
    throw new Error('Both an open and close time are required for a day that is not closed');
  }
  if (closeTime === openTime) {
    throw new Error('Open and close time cannot be identical');
  }
}

/** Any logged-in user may read store hours — the schedule board needs this regardless of who is viewing it. */
export function listStoreHours(): StoreHours[] {
  return storeHoursRepo.listAll();
}

export interface UpsertStoreHoursInput {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

/** Only a manager may set the weekly-default hours for one day-of-week. */
export function upsertStoreHours(actor: RequestingActor, input: UpsertStoreHoursInput): StoreHours {
  assertManager(actor);
  assertValidHours(input.isClosed, input.openTime, input.closeTime);
  return storeHoursRepo.upsert(input);
}
