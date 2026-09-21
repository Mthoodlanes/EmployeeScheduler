import * as bowlerRepo from '../db/repositories/bowlerRepo.js';
import type { BowlerInput } from '../db/repositories/bowlerRepo.js';
import * as duesTeamRepo from '../db/repositories/duesTeamRepo.js';
import type { Bowler, RequestingActor } from '../db/domain-types.js';

export type { RequestingActor, BowlerInput };

export class UnauthorizedBowlerActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedBowlerActionError';
  }
}

export class BowlerNotFoundError extends Error {
  constructor(id: number) {
    super(`Bowler ${id} not found`);
    this.name = 'BowlerNotFoundError';
  }
}

/** Same access rule as the client's `canAccessSecretaryArea` — see `src/renderer/src/utils/secretaryAccess.ts`. */
function assertSecretaryAccess(actor: RequestingActor): void {
  if (actor.role !== 'secretary' && actor.role !== 'manager' && !actor.isSecretaryTagged) {
    throw new UnauthorizedBowlerActionError('Only Secretary-area accounts can manage bowlers');
  }
}

function assertValidBowler(input: BowlerInput): void {
  if (!input.name.trim()) {
    throw new Error('Bowler name is required');
  }
  if (input.depositPaid < 0) {
    throw new Error('Deposit paid cannot be negative');
  }
}

export async function listBowlersForTeam(
  actor: RequestingActor,
  teamId: number,
): Promise<Bowler[]> {
  assertSecretaryAccess(actor);
  return bowlerRepo.listByTeam(teamId);
}

export async function listBowlersForTeams(
  actor: RequestingActor,
  teamIds: number[],
): Promise<Bowler[]> {
  assertSecretaryAccess(actor);
  return bowlerRepo.listByTeamIds(teamIds);
}

/**
 * Every bowler across every team in a league in one call — what the Roster
 * page needs to compute per-team bowler counts / empty-team detection
 * without an HTTP request per team, mirroring
 * `weeklyEntryService.listEntriesForLeague`'s identical convenience.
 */
export async function listBowlersForLeague(
  actor: RequestingActor,
  leagueId: number,
): Promise<Bowler[]> {
  assertSecretaryAccess(actor);
  const teams = await duesTeamRepo.listByLeague(leagueId);
  return bowlerRepo.listByTeamIds(teams.map((team) => team.id));
}

export async function createBowler(
  actor: RequestingActor,
  teamId: number,
  input: BowlerInput,
): Promise<Bowler> {
  assertSecretaryAccess(actor);
  assertValidBowler(input);
  const team = await duesTeamRepo.getById(teamId);
  if (!team) {
    throw new Error(`Team ${teamId} not found`);
  }
  return bowlerRepo.create(teamId, input);
}

export async function updateBowler(
  actor: RequestingActor,
  id: number,
  input: BowlerInput,
): Promise<Bowler> {
  assertSecretaryAccess(actor);
  assertValidBowler(input);
  const existing = await bowlerRepo.getById(id);
  if (!existing) {
    throw new BowlerNotFoundError(id);
  }
  return bowlerRepo.update(id, input);
}

/** Cascades to every weekly_entry for this bowler. */
export async function removeBowler(actor: RequestingActor, id: number): Promise<void> {
  assertSecretaryAccess(actor);
  const existing = await bowlerRepo.getById(id);
  if (!existing) {
    throw new BowlerNotFoundError(id);
  }
  await bowlerRepo.remove(id);
}
