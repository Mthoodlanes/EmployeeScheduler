import * as duesTeamRepo from '../db/repositories/duesTeamRepo.js';
import type { DuesTeamInput } from '../db/repositories/duesTeamRepo.js';
import * as leagueRepo from '../db/repositories/leagueRepo.js';
import * as bowlerRepo from '../db/repositories/bowlerRepo.js';
import type { DuesTeam, RequestingActor } from '../db/domain-types.js';

export type { RequestingActor, DuesTeamInput };

export class UnauthorizedDuesTeamActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedDuesTeamActionError';
  }
}

export class DuesTeamNotFoundError extends Error {
  constructor(id: number) {
    super(`Team ${id} not found`);
    this.name = 'DuesTeamNotFoundError';
  }
}

/** Same access rule as the client's `canAccessSecretaryArea` — see `src/renderer/src/utils/secretaryAccess.ts`. */
function assertSecretaryAccess(actor: RequestingActor): void {
  if (actor.role !== 'secretary' && actor.role !== 'manager' && !actor.isSecretaryTagged) {
    throw new UnauthorizedDuesTeamActionError('Only Secretary-area accounts can manage teams');
  }
}

function assertValidTeam(input: DuesTeamInput): void {
  if (!input.name.trim()) {
    throw new Error('Team name is required');
  }
  if (input.sponsorPaid < 0) {
    throw new Error('Sponsor paid cannot be negative');
  }
}

export async function listTeamsForLeague(
  actor: RequestingActor,
  leagueId: number,
): Promise<DuesTeam[]> {
  assertSecretaryAccess(actor);
  return duesTeamRepo.listByLeague(leagueId);
}

export async function createTeam(
  actor: RequestingActor,
  leagueId: number,
  input: DuesTeamInput,
): Promise<DuesTeam> {
  assertSecretaryAccess(actor);
  assertValidTeam(input);
  const league = await leagueRepo.getById(leagueId);
  if (!league) {
    throw new Error(`League ${leagueId} not found`);
  }
  return duesTeamRepo.create(leagueId, input);
}

export async function updateTeam(
  actor: RequestingActor,
  id: number,
  input: DuesTeamInput,
): Promise<DuesTeam> {
  assertSecretaryAccess(actor);
  assertValidTeam(input);
  const existing = await duesTeamRepo.getById(id);
  if (!existing) {
    throw new DuesTeamNotFoundError(id);
  }
  return duesTeamRepo.update(id, input);
}

/** Cascades to every bowler/weekly_entry under this team. */
export async function removeTeam(actor: RequestingActor, id: number): Promise<void> {
  assertSecretaryAccess(actor);
  const existing = await duesTeamRepo.getById(id);
  if (!existing) {
    throw new DuesTeamNotFoundError(id);
  }
  await duesTeamRepo.remove(id);
}

/** "Remove Empty Teams" bulk cleanup from the original app's Roster screen. */
export async function removeEmptyTeams(actor: RequestingActor, leagueId: number): Promise<number> {
  assertSecretaryAccess(actor);
  const teams = await duesTeamRepo.listByLeague(leagueId);
  const bowlersByTeam = await bowlerRepo.listByTeamIds(teams.map((team) => team.id));
  const teamIdsWithBowlers = new Set(bowlersByTeam.map((bowler) => bowler.teamId));
  const emptyTeams = teams.filter((team) => !teamIdsWithBowlers.has(team.id));

  await Promise.all(emptyTeams.map((team) => duesTeamRepo.remove(team.id)));
  return emptyTeams.length;
}
