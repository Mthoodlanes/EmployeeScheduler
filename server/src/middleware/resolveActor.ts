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
 * re-issued with a renewed 2-hour window, so an actively-used session never
 * expires mid-session — only a session left untouched for a full 2 hours
 * expires (e.g. an unattended shared computer, or coming back the next day).
 *
 * Session revocation (found via E2E testing): a token's own signature/expiry
 * being valid isn't enough — it must also carry the employee's CURRENT
 * `session_version` (see schema.ts), checked against the database on every
 * request. Logging out (or being deactivated) bumps that counter, which
 * makes every token issued before that moment permanently invalid, no
 * matter how recently it was signed or re-signed. This closes a real race
 * that a plain "clear the cookie on logout" can't: an authenticated GET
 * request already in flight when logout is clicked resolves independently,
 * sees the (still valid at THAT instant) old cookie, and re-issues a fresh
 * sliding-expiry cookie of its own — confirmed live, this can land in the
 * browser after logout's own cookie-clear response and silently undo it.
 * The version check makes that harmless: the resurrected cookie still
 * carries the pre-logout version, so the very next request rejects it too.
 *
 * That said, the `/api/auth/logout` request itself still skips the refresh
 * below (see the `req.path` check) rather than relying purely on the version
 * check to clean it up one request later: confirmed live in a real browser
 * that two `Set-Cookie` headers for the same cookie in one response (this
 * refresh, plus the logout route's own `clearCookie()` right after) doesn't
 * reliably resolve the way a spec-compliant cookie jar would (last one
 * wins) — simplest to just never emit the first one on this path at all.
 */
import type { NextFunction, Request, Response } from 'express';
import { signActorToken, verifyActorToken } from '../auth/jwt.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../auth/cookie.js';
import * as employeeRepo from '../db/repositories/employeeRepo.js';

export async function resolveActor(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (!token) {
    next();
    return;
  }

  const verified = verifyActorToken(token);
  if (!verified) {
    next();
    return;
  }

  const { sessionVersion, ...actor } = verified;
  const currentSessionVersion = await employeeRepo.getSessionVersion(actor.id);
  if (currentSessionVersion === null || currentSessionVersion !== sessionVersion) {
    // Revoked (logged out/deactivated since this token was issued) or the
    // employee no longer exists. Clear the now-permanently-invalid cookie
    // so the browser stops resending it, and proceed unauthenticated rather
    // than rejecting outright — some routes (login, first-run, health) are
    // intentionally public.
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
    next();
    return;
  }

  req.actor = actor;
  if (req.path !== '/api/auth/logout') {
    res.cookie(SESSION_COOKIE_NAME, signActorToken(actor, currentSessionVersion), sessionCookieOptions);
  }
  next();
}
