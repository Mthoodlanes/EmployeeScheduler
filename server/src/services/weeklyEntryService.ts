import * as weeklyEntryRepo from '../db/repositories/weeklyEntryRepo.js';
import * as bowlerRepo from '../db/repositories/bowlerRepo.js';
import * as duesTeamRepo from '../db/repositories/duesTeamRepo.js';
import type { RequestingActor, WeeklyEntry } from '../db/domain-types.js';

export type { RequestingActor };

export class UnauthorizedWeeklyEntryActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedWeeklyEntryActionError';
  }
}

/** Same access rule as the client's `canAccessSecretaryArea` — see `src/renderer/src/utils/secretaryAccess.ts`. */
function assertSecretaryAccess(actor: RequestingActor): void {
  if (actor.role !== 'secretary' && actor.role !== 'manager' && !actor.isSecretaryTagged) {
    throw new UnauthorizedWeeklyEntryActionError(
      'Only Secretary-area accounts can manage weekly entries',
    );
  }
}

export async function listEntriesForBowlers(
  actor: RequestingActor,
  bowlerIds: number[],
): Promise<WeeklyEntry[]> {
  assertSecretaryAccess(actor);
  return weeklyEntryRepo.listByBowlerIds(bowlerIds);
}

/**
 * Every entry for a whole league in one call — what the Weekly Entries,
 * Weekly Banking and Summary pages all need to feed `duesLedger.ts`'s pure
 * functions, which take a league's full flat entry list rather than
 * per-bowler slices.
 */
export async function listEntriesForLeague(
  actor: RequestingActor,
  leagueId: number,
): Promise<WeeklyEntry[]> {
  assertSecretaryAccess(actor);
  const teams = await duesTeamRepo.listByLeague(leagueId);
  const bowlers = await bowlerRepo.listByTeamIds(teams.map((team) => team.id));
  return weeklyEntryRepo.listByBowlerIds(bowlers.map((bowler) => bowler.id));
}

export async function recordAmount(
  actor: RequestingActor,
  bowlerId: number,
  week: number,
  amountPaid: number,
): Promise<WeeklyEntry> {
  assertSecretaryAccess(actor);
  if (week < 1) {
    throw new Error('Week must be at least 1');
  }
  if (amountPaid < 0) {
    throw new Error('Amount paid cannot be negative');
  }
  const bowler = await bowlerRepo.getById(bowlerId);
  if (!bowler) {
    throw new Error(`Bowler ${bowlerId} not found`);
  }
  return weeklyEntryRepo.upsertAmount(bowlerId, week, amountPaid);
}

export async function removeEntry(
  actor: RequestingActor,
  bowlerId: number,
  week: number,
): Promise<void> {
  assertSecretaryAccess(actor);
  await weeklyEntryRepo.remove(bowlerId, week);
}
