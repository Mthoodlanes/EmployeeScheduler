import * as leagueRepo from '../db/repositories/leagueRepo.js';
import type { LeagueInput } from '../db/repositories/leagueRepo.js';
import type { League, RequestingActor } from '../db/domain-types.js';

export type { RequestingActor, LeagueInput };

export class UnauthorizedLeagueActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedLeagueActionError';
  }
}

export class LeagueNotFoundError extends Error {
  constructor(id: number) {
    super(`League ${id} not found`);
    this.name = 'LeagueNotFoundError';
  }
}

/** Same access rule as the client's `canAccessSecretaryArea` — see `src/renderer/src/utils/secretaryAccess.ts`. */
function assertSecretaryAccess(actor: RequestingActor): void {
  if (actor.role !== 'secretary' && actor.role !== 'manager' && !actor.isSecretaryTagged) {
    throw new UnauthorizedLeagueActionError('Only Secretary-area accounts can manage leagues');
  }
}

function assertValidLeague(input: LeagueInput): void {
  if (!input.name.trim()) {
    throw new Error('League name is required');
  }
  if (input.spotsPerTeam < 1) {
    throw new Error('Spots per team must be at least 1');
  }
  if (input.numWeeks < 1) {
    throw new Error('Number of weeks must be at least 1');
  }
  if (input.currentWeek < 1 || input.currentWeek > input.numWeeks) {
    throw new Error('Current week must fall within the season length');
  }
}

/** Every Secretary-area user sees every league — see schema.ts's comment on why this isn't scoped per-creator. */
export async function listLeagues(actor: RequestingActor): Promise<League[]> {
  assertSecretaryAccess(actor);
  return leagueRepo.listAll();
}

export async function getLeague(actor: RequestingActor, id: number): Promise<League> {
  assertSecretaryAccess(actor);
  const league = await leagueRepo.getById(id);
  if (!league) {
    throw new LeagueNotFoundError(id);
  }
  return league;
}

export async function createLeague(actor: RequestingActor, input: LeagueInput): Promise<League> {
  assertSecretaryAccess(actor);
  assertValidLeague(input);
  return leagueRepo.create(input, actor.id);
}

export async function updateLeague(
  actor: RequestingActor,
  id: number,
  input: LeagueInput,
): Promise<League> {
  assertSecretaryAccess(actor);
  assertValidLeague(input);
  const existing = await leagueRepo.getById(id);
  if (!existing) {
    throw new LeagueNotFoundError(id);
  }
  return leagueRepo.update(id, input);
}

/** Cascades to every team/bowler/weekly_entry under this league. */
export async function removeLeague(actor: RequestingActor, id: number): Promise<void> {
  assertSecretaryAccess(actor);
  const existing = await leagueRepo.getById(id);
  if (!existing) {
    throw new LeagueNotFoundError(id);
  }
  await leagueRepo.remove(id);
}
