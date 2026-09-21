import { asc, eq } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { teams } from '../schema.js';
import type { DuesTeam } from '../domain-types.js';

type TeamRow = typeof teams.$inferSelect;

function toDuesTeam(row: TeamRow): DuesTeam {
  return {
    id: row.id,
    leagueId: row.leagueId,
    name: row.name,
    folded: row.folded,
    sponsorPaid: Number(row.sponsorPaid),
  };
}

export interface DuesTeamInput {
  name: string;
  folded: boolean;
  sponsorPaid: number;
}

export async function listByLeague(leagueId: number): Promise<DuesTeam[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(asc(teams.name));
  return rows.map(toDuesTeam);
}

export async function getById(id: number): Promise<DuesTeam | undefined> {
  const db = getDb();
  const [row] = await db.select().from(teams).where(eq(teams.id, id));
  return row ? toDuesTeam(row) : undefined;
}

export async function create(leagueId: number, input: DuesTeamInput): Promise<DuesTeam> {
  const db = getDb();
  const [inserted] = await db
    .insert(teams)
    .values({
      leagueId,
      name: input.name,
      folded: input.folded,
      sponsorPaid: input.sponsorPaid.toString(),
    })
    .returning({ id: teams.id });

  const created = await getById(inserted.id);
  if (!created) {
    throw new Error('Failed to load team immediately after creation');
  }
  return created;
}

export async function update(id: number, input: DuesTeamInput): Promise<DuesTeam> {
  const db = getDb();
  await db
    .update(teams)
    .set({
      name: input.name,
      folded: input.folded,
      sponsorPaid: input.sponsorPaid.toString(),
      updatedAt: new Date(),
    })
    .where(eq(teams.id, id));

  const updated = await getById(id);
  if (!updated) {
    throw new Error(`Team ${id} not found after update`);
  }
  return updated;
}

/** Cascades to every bowler/weekly_entry under this team (see schema.ts's `onDelete: 'cascade'` chain). */
export async function remove(id: number): Promise<void> {
  const db = getDb();
  await db.delete(teams).where(eq(teams.id, id));
}
