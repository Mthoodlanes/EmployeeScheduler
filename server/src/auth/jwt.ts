/**
 * Milestone 17: JWT issuance/verification for the httpOnly-cookie auth
 * scheme described in the Phase 2 plan's "Auth Strategy" bullet — a signed
 * `{ employeeId, role, sessionVersion }` token with a 7-day expiry, replacing
 * `src/main/session.ts`'s module-level singleton with a stateless,
 * request-scoped identity that the `resolveActor` middleware turns into
 * `req.actor: RequestingActor`.
 *
 * Deliberately narrow surface: this module only signs/verifies tokens. It
 * knows nothing about cookies (see `./cookie.ts`) or HTTP at all.
 */
import jwt from 'jsonwebtoken';
import type { RequestingActor, Role } from '../db/domain-types.js';

/**
 * 7 days, in seconds — both the JWT's own expiry and (via `./cookie.ts`,
 * which imports this) the session cookie's `maxAge`, so the two always stay
 * in lockstep.
 */
export const SESSION_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

interface ActorTokenPayload {
  employeeId: number;
  role: Role;
  /**
   * Milestone 26 (session revocation): a per-employee counter, bumped on
   * logout/deactivation. `resolveActor` compares this against the CURRENT
   * value in the database on every request — a mismatch means this token
   * was issued before the most recent logout/deactivation and is rejected,
   * no matter how recently it was signed or re-signed. This is what makes
   * logout actually final, closing a real race where an in-flight
   * authenticated request could re-issue a fresh sliding-expiry cookie
   * moments after the logout response tried to clear it.
   */
  sessionVersion: number;
  /**
   * Secretary Apps Milestone 4: grants Secretary-area access independent of
   * `role` (see schema.ts's `is_secretary_tagged` column comment). Embedded
   * here rather than looked up fresh per request, the same way `role`
   * itself already works — a change to this flag takes effect on that
   * employee's NEXT login/token refresh, not mid-session. `resolveActor`
   * doesn't specially double-check this the way it does `sessionVersion`;
   * it's authorization data, not a revocation signal.
   *
   * OPTIONAL on purpose: a token signed before this field existed has no
   * way to carry it. Treating it as required here would make
   * `isActorTokenPayload` reject every already-issued token the instant
   * this deploys, forcing every signed-in employee (all of them entirely
   * unrelated to Secretary Apps) to re-log-in for no real reason.
   * `verifyActorToken` below defaults a missing value to `false`, which is
   * exactly correct anyway — nobody could have been tagged before this
   * field existed.
   */
  isSecretaryTagged?: boolean;
}

function isRole(value: unknown): value is Role {
  return (
    value === 'manager' || value === 'employee' || value === 'coordinator' || value === 'secretary'
  );
}

function isActorTokenPayload(value: unknown): value is ActorTokenPayload {
  const secretaryTagged = (value as ActorTokenPayload | null)?.isSecretaryTagged;
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ActorTokenPayload).employeeId === 'number' &&
    isRole((value as ActorTokenPayload).role) &&
    typeof (value as ActorTokenPayload).sessionVersion === 'number' &&
    (secretaryTagged === undefined || typeof secretaryTagged === 'boolean')
  );
}

/**
 * Reads `JWT_SECRET` on every call rather than caching it at module-load
 * time, so a missing secret fails loudly the first time a token actually
 * needs to be signed/verified instead of silently signing with `undefined`
 * (which the `jsonwebtoken` types would otherwise permit). `server/src/index.ts`
 * also calls this eagerly at startup so a missing secret is caught before
 * the server starts accepting requests, not on the first login attempt.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is not set. Refusing to sign or verify session tokens without it.',
    );
  }
  return secret;
}

export function signActorToken(actor: RequestingActor, sessionVersion: number): string {
  const payload: ActorTokenPayload = {
    employeeId: actor.id,
    role: actor.role,
    sessionVersion,
    isSecretaryTagged: actor.isSecretaryTagged,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: SESSION_TOKEN_TTL_SECONDS });
}

/** A token's decoded identity plus the session-version it was signed with — see `ActorTokenPayload.sessionVersion`. */
export interface VerifiedActorToken extends RequestingActor {
  sessionVersion: number;
}

/**
 * Returns `null` on ANY verification failure — expired, malformed, wrong
 * signature, or a well-formed-but-wrong-shape payload — never throws past
 * this boundary. Callers (the `resolveActor` middleware) treat `null`
 * identically to "no cookie at all". Deliberately does NOT check the
 * session version against the database itself — this module only
 * signs/verifies tokens and knows nothing about the database (see the file
 * header); `resolveActor` does that comparison since it already owns the
 * async DB access on every request.
 */
export function verifyActorToken(token: string): VerifiedActorToken | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!isActorTokenPayload(decoded)) {
      return null;
    }
    return {
      id: decoded.employeeId,
      role: decoded.role,
      sessionVersion: decoded.sessionVersion,
      isSecretaryTagged: decoded.isSecretaryTagged ?? false,
    };
  } catch {
    return null;
  }
}
