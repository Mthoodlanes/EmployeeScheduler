/**
 * Milestone 17: route-level enforcement, separate from `resolveActor`'s
 * pure resolution. Any route that should reject unauthenticated callers
 * mounts this after `resolveActor` has already run globally (see
 * `server/src/index.ts`).
 *
 * Only 35-business-route wiring (Milestone 18) is out of scope here — this
 * middleware itself is the general-purpose building block that milestone
 * will reuse route-by-route.
 */
import type { NextFunction, Request, Response } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.actor) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}
