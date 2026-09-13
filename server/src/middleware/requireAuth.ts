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
    // Milestone 18 fix: every one of the 35 ported IPC routes that mounts
    // this middleware promises the `{ok:true,data}`/`{ok:false,error}`
    // envelope "regardless of status code" (see `server/src/routes/httpResult.ts`).
    // Since this middleware runs BEFORE a route's `handleRoute`-wrapped
    // handler and responds directly rather than throwing into it, its body
    // needs the `ok:false` field added explicitly here to keep that promise
    // — a bare `{error}` body (the shape before this fix) would otherwise be
    // the one response those 35 routes could ever send that broke the
    // envelope contract. `auth.routes.ts`'s OWN hand-written error bodies are
    // deliberately unaffected (see that file's header comment) since this
    // change only touches this shared middleware's own JSON body.
    res.status(401).json({ ok: false, error: 'Authentication required' });
    return;
  }
  next();
}
