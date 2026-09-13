/**
 * Milestone 17: declaration merging so `req.actor` (set by the
 * `resolveActor` middleware) is a known, typed property on every Express
 * `Request` without an `as`-cast at every call site. `actor` is optional
 * since `resolveActor` deliberately leaves it undefined when there's no
 * valid session cookie — enforcement is `requireAuth`'s job, not this
 * middleware's or this type's.
 */
import type { RequestingActor } from '../db/domain-types.js';

declare global {
  namespace Express {
    interface Request {
      actor?: RequestingActor;
    }
  }
}

export {};
