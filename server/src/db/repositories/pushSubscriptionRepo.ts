import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../../db.js';
import { pushSubscriptions } from '../schema.js';

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** One row per (employee, browser/device) — re-subscribing the same device just re-stamps the same endpoint's keys rather than growing duplicates. */
export async function upsert(
  employeeId: number,
  input: PushSubscriptionInput,
): Promise<void> {
  const db = getDb();
  await db
    .insert(pushSubscriptions)
    .values({ employeeId, ...input })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { employeeId, p256dh: input.p256dh, auth: input.auth },
    });
}

export async function removeByEndpoint(endpoint: string): Promise<void> {
  const db = getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/** Called on employee deactivation — employees are soft-deactivated, never hard-deleted, so the `onDelete: 'cascade'` FK never fires on its own here. */
export async function removeAllForEmployee(employeeId: number): Promise<void> {
  const db = getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.employeeId, employeeId));
}

export async function listForEmployees(
  employeeIds: number[],
): Promise<{ employeeId: number; endpoint: string; p256dh: string; auth: string }[]> {
  if (employeeIds.length === 0) {
    return [];
  }
  const db = getDb();
  return db
    .select({
      employeeId: pushSubscriptions.employeeId,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.employeeId, employeeIds));
}
