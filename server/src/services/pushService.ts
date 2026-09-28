/**
 * Web Push for "your schedule was published" notifications. Deliberately
 * self-contained (no `RequestingActor` role checks beyond "must be logged
 * in", enforced by `requireAuth` at the route layer) — any employee may
 * subscribe/unsubscribe only their OWN devices; `notifyEmployees` below is
 * an internal function other services call directly, never a route.
 *
 * VAPID keys identify this app to push services (Chrome/FCM, Mozilla,
 * etc.) — generated once with `web-push generate-vapid-keys` (or
 * `webPush.generateVAPIDKeys()`) and set as `VAPID_PUBLIC_KEY`/
 * `VAPID_PRIVATE_KEY` env vars, the same way `JWT_SECRET` is configured.
 * `VAPID_SUBJECT` is a contact URL/mailto a push service can reach out to
 * about this app if something's wrong with how it's sending pushes.
 */
import webPush from 'web-push';
import * as pushSubscriptionRepo from '../db/repositories/pushSubscriptionRepo.js';
import type { PushSubscriptionInput } from '../db/repositories/pushSubscriptionRepo.js';
import type { RequestingActor } from '../db/domain-types.js';

export type { RequestingActor };

let vapidConfigured = false;

function ensureVapidConfigured(): void {
  if (vapidConfigured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT environment variables must all be set to use push notifications.',
    );
  }
  webPush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export function getVapidPublicKey(): string {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error('VAPID_PUBLIC_KEY environment variable is not set.');
  }
  return publicKey;
}

export async function subscribe(
  actor: RequestingActor,
  input: PushSubscriptionInput,
): Promise<void> {
  await pushSubscriptionRepo.upsert(actor.id, input);
}

/** An employee may only ever unsubscribe by endpoint (their own device's), never someone else's — there's nothing to check beyond "is logged in" since removing a row by an endpoint string can't affect any OTHER employee's real subscription (endpoints are opaque, per-device push-service URLs no one could plausibly guess). */
export async function unsubscribe(_actor: RequestingActor, endpoint: string): Promise<void> {
  await pushSubscriptionRepo.removeByEndpoint(endpoint);
}

export interface NotificationPayload {
  title: string;
  body: string;
  /** Hash-router path (e.g. "/my-schedule") the notification opens on click. */
  url: string;
}

/**
 * Sends to every device subscribed by any of `employeeIds`. Never throws —
 * a push service rejecting one subscription (expired, revoked, malformed)
 * must not stop the rest from being notified. A `404`/`410` response means
 * that subscription is permanently dead (the browser un-registered it, or
 * it's simply too old), so it's deleted rather than retried forever.
 */
export async function notifyEmployees(
  employeeIds: number[],
  payload: NotificationPayload,
): Promise<void> {
  if (employeeIds.length === 0) return;
  ensureVapidConfigured();

  const subscriptions = await pushSubscriptionRepo.listForEmployees(employeeIds);
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
        );
      } catch (err) {
        const { statusCode } = err as { statusCode?: number };
        if (statusCode === 404 || statusCode === 410) {
          await pushSubscriptionRepo.removeByEndpoint(subscription.endpoint);
        } else {
          // eslint-disable-next-line no-console -- worth surfacing in Render's log dashboard; never worth failing the publish action over.
          console.error(`Push notification failed for endpoint ${subscription.endpoint}:`, err);
        }
      }
    }),
  );
}
