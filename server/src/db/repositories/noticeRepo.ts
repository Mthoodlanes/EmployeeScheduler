import { desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { employees, notices } from '../schema.js';
import type { Notice } from '../domain-types.js';

type NoticeRow = typeof notices.$inferSelect;

function toNotice(row: NoticeRow, postedByName: string): Notice {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    postedByEmployeeId: row.postedByEmployeeId,
    postedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  };
}

export interface CreateNoticeInput {
  title: string;
  body: string;
  postedByEmployeeId: number;
  expiresAt: string | null;
}

export interface UpdateNoticeInput {
  id: number;
  title: string;
  body: string;
  expiresAt: string | null;
}

/** Every notice (expired included) newest first — the Notice Board shows past notices too, just visually distinguished. */
export async function listAll(): Promise<Notice[]> {
  const db = getDb();
  const rows = await db
    .select({ notice: notices, postedByName: employees.name })
    .from(notices)
    .innerJoin(employees, eq(notices.postedByEmployeeId, employees.id))
    .orderBy(desc(notices.createdAt));
  return rows.map((row) => toNotice(row.notice, row.postedByName));
}

export async function getById(id: number): Promise<Notice | undefined> {
  const db = getDb();
  const [row] = await db
    .select({ notice: notices, postedByName: employees.name })
    .from(notices)
    .innerJoin(employees, eq(notices.postedByEmployeeId, employees.id))
    .where(eq(notices.id, id));
  return row ? toNotice(row.notice, row.postedByName) : undefined;
}

/** The newest still-active (non-expired) notice's post time, or null if there are none — the "is there anything unread" comparison point. */
export async function getLatestActiveCreatedAt(): Promise<Date | null> {
  const db = getDb();
  const [row] = await db
    .select({ createdAt: notices.createdAt })
    .from(notices)
    .where(or(isNull(notices.expiresAt), gt(notices.expiresAt, sql`now()`)))
    .orderBy(desc(notices.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

export async function create(input: CreateNoticeInput): Promise<Notice> {
  const db = getDb();
  const [inserted] = await db
    .insert(notices)
    .values({
      title: input.title,
      body: input.body,
      postedByEmployeeId: input.postedByEmployeeId,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    })
    .returning({ id: notices.id });

  const created = await getById(inserted.id);
  if (!created) {
    throw new Error('Failed to load notice immediately after creation');
  }
  return created;
}

export async function update(input: UpdateNoticeInput): Promise<Notice> {
  const db = getDb();
  await db
    .update(notices)
    .set({
      title: input.title,
      body: input.body,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      updatedAt: sql`now()`,
    })
    .where(eq(notices.id, input.id));

  const updated = await getById(input.id);
  if (!updated) {
    throw new Error(`Notice ${input.id} not found after update`);
  }
  return updated;
}

export async function remove(id: number): Promise<void> {
  const db = getDb();
  await db.delete(notices).where(eq(notices.id, id));
}
