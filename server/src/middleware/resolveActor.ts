/**
 * Milestone 17: request-scoped identity resolution, replacing
 * `src/main/session.ts`'s module-level singleton (which only worked because
 * exactly one user was ever logged into the desktop app's single process).
 *
 * Runs on EVERY request, ahead of routing. It only RESOLVES identity when a
 * valid session cookie is present — it never rejects a request itself, since
 * some routes (login, first-run, health) are intentionally public. Route-level
 * enforcement is `requireAuth`'s job (see `./requireAuth.ts`).
 *
 * Sliding expiry: whenever a valid cookie is found, a fresh token/cookie is
 * re-issued with a renewed 7-day window, so an actively-used session never
 * expires mid-session — only a session left untouched for a full 7 days
 * expires.
 */
import type { NextFunction, Request, Response } from 'express';
import { signActorToken, verifyActorToken } from '../auth/jwt.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../auth/cookie.js';

export function resolveActor(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (!token) {
    next();
    return;
  }

  const actor = verifyActorToken(token);
  if (!actor) {
    next();
    return;
  }

  req.actor = actor;
  res.cookie(SESSION_COOKIE_NAME, signActorToken(actor), sessionCookieOptions);
  next();
}
