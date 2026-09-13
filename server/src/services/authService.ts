/**
 * Milestone 16: port of `src/main/services/authService.ts` onto the new
 * Drizzle `employeeRepo` (Milestone 15). `authService` is special among the
 * 9 services: it is what ISSUES an identity rather than something gated
 * behind an already-established `RequestingActor` — there is no actor to
 * check on login/first-run, since that is the very thing being established.
 *
 * Deliberately NOT ported here:
 * - JWT/httpOnly-cookie issuance — that is Milestone 17 ("Auth conversion").
 *   `login` below still just validates credentials and returns the
 *   `Employee` (minus password hash) on success, throwing on failure, same
 *   as the original synchronous version.
 * - `src/main/session.ts`'s module-level singleton — not ported at all. That
 *   concept is replaced entirely by request-scoped JWT auth in Milestone 17,
 *   so there is no server-side "current session" object in this codebase.
 */
import bcrypt from 'bcryptjs';
import * as employeeRepo from '../db/repositories/employeeRepo.js';
import type { Employee } from '../db/domain-types.js';

const SALT_ROUNDS = 10;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid username or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class FirstRunAlreadyCompleteError extends Error {
  constructor() {
    super('Setup has already been completed');
    this.name = 'FirstRunAlreadyCompleteError';
  }
}

/** Validates credentials against the employees table. Throws on failure. */
export async function login(username: string, password: string): Promise<Employee> {
  const employee = await employeeRepo.findByUsername(username);
  if (!employee || !employee.isActive) {
    throw new InvalidCredentialsError();
  }
  if (!verifyPassword(password, employee.passwordHash)) {
    throw new InvalidCredentialsError();
  }
  const { passwordHash, ...rest } = employee;
  return rest;
}

export async function isFirstRun(): Promise<boolean> {
  return (await employeeRepo.countEmployees()) === 0;
}

/**
 * Creates the very first manager account. Only allowed when the employees
 * table is empty — this is the one path that can create an account without
 * an existing manager being logged in.
 */
export async function createFirstManager(
  name: string,
  username: string,
  password: string,
): Promise<Employee> {
  if (!(await isFirstRun())) {
    throw new FirstRunAlreadyCompleteError();
  }
  const created = await employeeRepo.create({
    name,
    username,
    passwordHash: hashPassword(password),
    role: 'manager',
    isSalaried: false,
    departments: [],
  });
  const { departments, ...employee } = created;
  return employee;
}
