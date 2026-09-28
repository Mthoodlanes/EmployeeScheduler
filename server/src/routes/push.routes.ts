/**
 * HTTP routes for Web Push subscriptions, mounted at `/api/push`. All
 * routes require `requireAuth`; no route here checks role beyond that —
 * any logged-in employee may enable/disable notifications on their own
 * device. There is no "list my subscriptions" or "send a test push"
 * route by design (nothing in the UI needs either yet); the one thing
 * that actually SENDS a push is `scheduledShiftService.publishWeek`,
 * called directly rather than through a route of its own here.
 */
import { Router } from 'express';
import * as pushService from '../services/pushService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { handleRoute } from './httpResult.js';
import { bodyOf, requireString } from './validation.js';
import type { RequestingActor } from '../db/domain-types.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/vapid-public-key',
  handleRoute(() => ({ publicKey: pushService.getVapidPublicKey() })),
);

router.post(
  '/subscribe',
  handleRoute(async (req) => {
    const body = bodyOf(req);
    const keys = (body.keys ?? {}) as Record<string, unknown>;
    await pushService.subscribe(req.actor as RequestingActor, {
      endpoint: requireString(body.endpoint, 'endpoint'),
      p256dh: requireString(keys.p256dh, 'keys.p256dh'),
      auth: requireString(keys.auth, 'keys.auth'),
    });
    return { success: true };
  }),
);

router.post(
  '/unsubscribe',
  handleRoute(async (req) => {
    const body = bodyOf(req);
    await pushService.unsubscribe(req.actor as RequestingActor, requireString(body.endpoint, 'endpoint'));
    return { success: true };
  }),
);

export default router;
