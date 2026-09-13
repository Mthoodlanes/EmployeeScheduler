/**
 * Milestone 17: shared session-cookie name + options, used by both the auth
 * routes (setting/clearing the cookie) and the `resolveActor` middleware
 * (re-setting it on every request for sliding expiry). Centralized here so
 * the three call sites can never drift out of sync on flags.
 */
import type { CookieOptions } from 'express';
import { SESSION_TOKEN_TTL_SECONDS } from './jwt.js';

export const SESSION_COOKIE_NAME = 'mhl_session';

/**
 * `secure: true` requires HTTPS, which is how Render serves the app in
 * production — but local dev (`server:dev`, `npm run dev`) runs on plain
 * `http://localhost`, where a `secure` cookie is silently dropped by the
 * browser and login would appear to "not work" with no visible error. Gate
 * on `NODE_ENV` so local dev gets a non-secure cookie and production gets a
 * secure one.
 */
const isProduction = process.env.NODE_ENV === 'production';

/**
 * `maxAge` (milliseconds) intentionally mirrors the JWT's own 7-day expiry
 * (`SESSION_TOKEN_TTL_SECONDS`) — the cookie should never outlive the token
 * it carries, and vice versa.
 */
export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  maxAge: SESSION_TOKEN_TTL_SECONDS * 1000,
  path: '/',
};
