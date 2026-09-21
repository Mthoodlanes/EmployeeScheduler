/**
 * Milestone 17: `/api/auth/*` routes — the HTTP surface over `authService`
 * (Milestone 16), issuing/clearing the JWT session cookie around it. This is
 * the one auth-specific slice of the "HTTP API surface" work; the other 35
 * business routes are Milestone 18.
 *
 * Response bodies deliberately match this milestone's own spec (the plain
 * `Employee`/`{ isFirstRun }` shape), not the `{ok,data}/{ok,error}` IPC
 * envelope that Milestone 18 will use for the ported IPC channels — that
 * envelope's job is preserving the shape of 35 pre-existing IPC calls for a
 * mechanical `client.ts` port, which doesn't apply to these brand-new routes.
 */
import { Router, type Request, type Response } from 'express';
import * as authService from '../services/authService.js';
import * as employeeRepo from '../db/repositories/employeeRepo.js';
import { signActorToken } from '../auth/jwt.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../auth/cookie.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { Employee, RequestingActor } from '../db/domain-types.js';

const router = Router();

function actorFor(employee: Pick<Employee, 'id' | 'role' | 'isSecretaryTagged'>): RequestingActor {
  return { id: employee.id, role: employee.role, isSecretaryTagged: employee.isSecretaryTagged };
}

async function setSessionCookie(
  res: Response,
  employee: Pick<Employee, 'id' | 'role' | 'isSecretaryTagged'>,
): Promise<void> {
  const sessionVersion = await employeeRepo.getSessionVersion(employee.id);
  res.cookie(
    SESSION_COOKIE_NAME,
    signActorToken(actorFor(employee), sessionVersion ?? 0),
    sessionCookieOptions,
  );
}

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = (req.body ?? {}) as { username?: unknown; password?: unknown };
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  try {
    const employee = await authService.login(username, password);
    await setSessionCookie(res, employee);
    res.status(200).json(employee);
  } catch (error) {
    if (error instanceof authService.InvalidCredentialsError) {
      // Deliberately the same message regardless of whether the username or
      // the password was wrong — never leak which one it was.
      res.status(401).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  // Bump `session_version` FIRST (if a valid session is present) so the old
  // token is permanently invalid the instant this handler runs, closing the
  // in-flight-request race described in `resolveActor.ts`'s file header —
  // clearing the cookie alone can't do that on its own.
  const actor = req.actor as RequestingActor | undefined;
  if (actor) {
    await employeeRepo.incrementSessionVersion(actor.id);
  }
  // `clearCookie` regardless of whether a cookie was actually present.
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
  res.status(200).json({ ok: true });
});

/**
 * Doubles as the Milestone 17 "protected demonstration route": reaching the
 * handler at all proves `resolveActor` -> `requireAuth` -> `req.actor`
 * worked end to end. Looks the employee up fresh via `employeeRepo` (rather
 * than trusting the JWT payload alone) so a role change or deactivation
 * since the token was issued is reflected immediately.
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const actor = req.actor as RequestingActor;
  const employee = await employeeRepo.findById(actor.id);
  if (!employee) {
    res.status(401).json({ error: 'Session refers to an employee that no longer exists' });
    return;
  }
  const { passwordHash, ...rest } = employee;
  res.status(200).json(rest);
});

router.get('/first-run-status', async (_req: Request, res: Response) => {
  const isFirstRun = await authService.isFirstRun();
  res.status(200).json({ isFirstRun });
});

router.post('/first-run', async (req: Request, res: Response) => {
  const { name, username, password } = (req.body ?? {}) as {
    name?: unknown;
    username?: unknown;
    password?: unknown;
  };
  if (
    typeof name !== 'string' ||
    typeof username !== 'string' ||
    typeof password !== 'string'
  ) {
    res.status(400).json({ error: 'Name, username, and password are required' });
    return;
  }

  try {
    const employee = await authService.createFirstManager(name, username, password);
    // Matches the original Electron app's behavior: creating the first
    // manager auto-logs them in.
    await setSessionCookie(res, employee);
    res.status(201).json(employee);
  } catch (error) {
    if (error instanceof authService.FirstRunAlreadyCompleteError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

export default router;
