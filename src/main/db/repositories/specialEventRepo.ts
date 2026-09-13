import { getDb } from '../connection';
import type { SpecialEventOverride } from '../../../shared/types/domain';

interface SpecialEventRow {
  id: number;
  event_date: string;
  label: string;
  is_closed: number;
  open_time: string | null;
  close_time: string | null;
  created_at: string;
  updated_at: string;
}

function toSpecialEvent(row: SpecialEventRow): SpecialEventOverride {
  return {
    id: row.id,
    eventDate: row.event_date,
    label: row.label,
    isClosed: row.is_closed === 1,
    openTime: row.open_time,
    closeTime: row.close_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
export function listAll(): SpecialEventOverride[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM special_event_overrides ORDER BY event_date')
    .all() as SpecialEventRow[];
  return rows.map(toSpecialEvent);
}

export function getById(id: number): SpecialEventOverride | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM special_event_overrides WHERE id = ?').get(id) as
    SpecialEventRow | undefined;
  return row ? toSpecialEvent(row) : undefined;
}

/** Looks up the (at most one, per the table's `UNIQUE` constraint) override for an exact date. */
export function getByDate(eventDate: string): SpecialEventOverride | undefined {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM special_event_overrides WHERE event_date = ?')
    .get(eventDate) as SpecialEventRow | undefined;
  return row ? toSpecialEvent(row) : undefined;
}

export function create(input: CreateSpecialEventInput): SpecialEventOverride {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO special_event_overrides (event_date, label, is_closed, open_time, close_time)
       VALUES (@eventDate, @label, @isClosed, @openTime, @closeTime)`,
    )
    .run({
      eventDate: input.eventDate,
      label: input.label,
      isClosed: input.isClosed ? 1 : 0,
      openTime: input.isClosed ? null : input.openTime,
      closeTime: input.isClosed ? null : input.closeTime,
    });

  const created = getById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error('Failed to load special event override immediately after creation');
  }
  return created;
}

export function update(input: UpdateSpecialEventInput): SpecialEventOverride {
  const db = getDb();
  db.prepare(
    `UPDATE special_event_overrides
     SET event_date = ?, label = ?, is_closed = ?, open_time = ?, close_time = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ).run(
    input.eventDate,
    input.label,
    input.isClosed ? 1 : 0,
    input.isClosed ? null : input.openTime,
    input.isClosed ? null : input.closeTime,
    input.id,
  );

  const updated = getById(input.id);
  if (!updated) {
    throw new Error(`Special event override ${input.id} not found after update`);
  }
  return updated;
}

export function remove(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM special_event_overrides WHERE id = ?').run(id);
}
