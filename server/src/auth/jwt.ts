/**
 * Milestone 17: JWT issuance/verification for the httpOnly-cookie auth
 * scheme described in the Phase 2 plan's "Auth Strategy" bullet — a signed
 * `{ employeeId, role }` token with a 7-day expiry, replacing
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
}

function isRole(value: unknown): value is Role {
  return value === 'manager' || value === 'employee';
}

function isActorTokenPayload(value: unknown): value is ActorTokenPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ActorTokenPayload).employeeId === 'number' &&
    isRole((value as ActorTokenPayload).role)
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

export function signActorToken(actor: RequestingActor): string {
  const payload: ActorTokenPayload = { employeeId: actor.id, role: actor.role };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: SESSION_TOKEN_TTL_SECONDS });
}

/**
 * Returns `null` on ANY verification failure — expired, malformed, wrong
 * signature, or a well-formed-but-wrong-shape payload — never throws past
 * this boundary. Callers (the `resolveActor` middleware) treat `null`
 * identically to "no cookie at all".
 */
export function verifyActorToken(token: string): RequestingActor | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!isActorTokenPayload(decoded)) {
      return null;
    }
    return { id: decoded.employeeId, role: decoded.role };
  } catch {
    return null;
  }
}
