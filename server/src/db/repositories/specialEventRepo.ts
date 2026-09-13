import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { specialEventOverrides } from '../schema.js';
import type { SpecialEventOverride } from '../domain-types.js';

type SpecialEventRow = typeof specialEventOverrides.$inferSelect;

function toSpecialEvent(row: SpecialEventRow): SpecialEventOverride {
  return {
    id: row.id,
    eventDate: row.eventDate,
    label: row.label,
    isClosed: row.isClosed,
    openTime: row.openTime,
    closeTime: row.closeTime,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface CreateSpecialEventInput {
  eventDate: string;
  label: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface UpdateSpecialEventInput {
  id: number;
  eventDate: string;
  label: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

/** Lists every override, soonest date first — used by the admin page's upcoming list. */
export async function listAll(): Promise<SpecialEventOverride[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(specialEventOverrides)
    .orderBy(asc(specialEventOverrides.eventDate));
  return rows.map(toSpecialEvent);
}

export async function getById(id: number): Promise<SpecialEventOverride | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(specialEventOverrides)
    .where(eq(specialEventOverrides.id, id));
  return row ? toSpecialEvent(row) : undefined;
}

/** Looks up the (at most one, per the table's `UNIQUE` constraint) override for an exact date. */
export async function getByDate(eventDate: string): Promise<SpecialEventOverride | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(specialEventOverrides)
    .where(eq(specialEventOverrides.eventDate, eventDate));
  return row ? toSpecialEvent(row) : undefined;
}

export async function create(input: CreateSpecialEventInput): Promise<SpecialEventOverride> {
  const db = getDb();
  const [inserted] = await db
    .insert(specialEventOverrides)
    .values({
      eventDate: input.eventDate,
      label: input.label,
      isClosed: input.isClosed,
      openTime: input.isClosed ? null : input.openTime,
      closeTime: input.isClosed ? null : input.closeTime,
    })
    .returning({ id: specialEventOverrides.id });

  const created = await getById(inserted.id);
  if (!created) {
    throw new Error('Failed to load special event override immediately after creation');
  }
  return created;
}

export async function update(input: UpdateSpecialEventInput): Promise<SpecialEventOverride> {
  const db = getDb();
  await db
    .update(specialEventOverrides)
    .set({
      eventDate: input.eventDate,
      label: input.label,
      isClosed: input.isClosed,
      openTime: input.isClosed ? null : input.openTime,
      closeTime: input.isClosed ? null : input.closeTime,
      updatedAt: sql`now()`,
    })
    .where(eq(specialEventOverrides.id, input.id));

  const updated = await getById(input.id);
  if (!updated) {
    throw new Error(`Special event override ${input.id} not found after update`);
  }
  return updated;
}

export async function remove(id: number): Promise<void> {
  const db = getDb();
  await db.delete(specialEventOverrides).where(eq(specialEventOverrides.id, id));
}
