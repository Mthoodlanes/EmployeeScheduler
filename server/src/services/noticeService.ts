/**
 * Milestone 26: the notice board — managers and the new 'coordinator' role
 * can post/edit/remove announcements (e.g. new specials); every logged-in
 * employee can read them. Unread tracking compares the newest active
 * notice's `createdAt` against the actor's own `last_read_notices_at`
 * column (see `employeeRepo.getLastReadNoticesAt`/`markNoticesRead`) rather
 * than a per-notice-per-employee read table — simple and sufficient for a
 * single shared announcement feed.
 */
import * as noticeRepo from '../db/repositories/noticeRepo.js';
import * as employeeRepo from '../db/repositories/employeeRepo.js';
import type { Notice, RequestingActor } from '../db/domain-types.js';

export type { RequestingActor };

export class NoticeNotFoundError extends Error {
  constructor(id: number) {
    super(`Notice ${id} not found`);
    this.name = 'NoticeNotFoundError';
  }
}

export class UnauthorizedNoticeActionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'UnauthorizedNoticeActionError';
  }
}

function assertCanPost(actor: RequestingActor): void {
  if (actor.role !== 'manager' && actor.role !== 'coordinator') {
    throw new UnauthorizedNoticeActionError(
      'Only a manager or event coordinator can manage the notice board',
    );
  }
}

function assertValidNotice(title: string, body: string): void {
  if (!title || !title.trim()) {
    throw new Error('A title is required');
  }
  if (!body || !body.trim()) {
    throw new Error('A notice body is required');
  }
}

/** Any logged-in employee may read the notice board. */
export async function listNotices(): Promise<Notice[]> {
  return noticeRepo.listAll();
}

export interface CreateNoticeInput {
  title: string;
  body: string;
  expiresAt: string | null;
}

/** Manager or coordinator only. */
export async function createNotice(
  actor: RequestingActor,
  input: CreateNoticeInput,
): Promise<Notice> {
  assertCanPost(actor);
  assertValidNotice(input.title, input.body);
  return noticeRepo.create({
    title: input.title,
    body: input.body,
    postedByEmployeeId: actor.id,
    expiresAt: input.expiresAt,
  });
}

export interface UpdateNoticeInput {
  id: number;
  title: string;
  body: string;
  expiresAt: string | null;
}

/** Manager or coordinator only — either may edit any notice, not just their own. */
export async function updateNotice(
  actor: RequestingActor,
  input: UpdateNoticeInput,
): Promise<Notice> {
  assertCanPost(actor);
  assertValidNotice(input.title, input.body);
  const existing = await noticeRepo.getById(input.id);
  if (!existing) {
    throw new NoticeNotFoundError(input.id);
  }
  return noticeRepo.update(input);
}

/** Manager or coordinator only. */
export async function removeNotice(actor: RequestingActor, id: number): Promise<void> {
  assertCanPost(actor);
  const existing = await noticeRepo.getById(id);
  if (!existing) {
    throw new NoticeNotFoundError(id);
  }
  await noticeRepo.remove(id);
}

/** Any logged-in employee — true if a notice newer than their last visit to the board exists (and hasn't since expired). */
export async function hasUnreadNotices(actor: RequestingActor): Promise<boolean> {
  const [latestActiveCreatedAt, lastReadAt] = await Promise.all([
    noticeRepo.getLatestActiveCreatedAt(),
    employeeRepo.getLastReadNoticesAt(actor.id),
  ]);
  if (!latestActiveCreatedAt) {
    return false;
  }
  if (!lastReadAt) {
    return true;
  }
  return latestActiveCreatedAt.getTime() > lastReadAt.getTime();
}

/** Any logged-in employee — call when they open the Notice Board. */
export async function markNoticesRead(actor: RequestingActor): Promise<void> {
  await employeeRepo.markNoticesRead(actor.id);
}
