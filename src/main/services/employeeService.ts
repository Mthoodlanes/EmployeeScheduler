import * as employeeRepo from '../db/repositories/employeeRepo';
import { hashPassword, InvalidCredentialsError, verifyPassword } from './authService';
import type { Department, Role } from '../../shared/types/domain';
import type { EmployeeWithDepartmentsRow } from '../db/repositories/employeeRepo';

export class DuplicateUsernameError extends Error {
  constructor(username: string) {
    super(`Username "${username}" is already taken`);
    this.name = 'DuplicateUsernameError';
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

export interface CreateEmployeeInput {
  name: string;
  username: string;
  password: string;
  role: Role;
  isSalaried: boolean;
  departments: Department[];
}

export function listEmployees(): EmployeeWithDepartmentsRow[] {
  return employeeRepo.listAll();
}

export function createEmployee(input: CreateEmployeeInput): EmployeeWithDepartmentsRow {
  // Proactive case-insensitive check: the DB's UNIQUE constraint on
  // `username` is case-sensitive, so "Doug" and "doug" wouldn't collide at
  // that layer even though findByUsername (used for sign-in) now treats them
  // as the same account. Catch it here instead of letting a case-variant
  // duplicate slip in and become unreachable/ambiguous at login.
  if (employeeRepo.findByUsername(input.username)) {
    throw new DuplicateUsernameError(input.username);
  }
  try {
    return employeeRepo.create({
      name: input.name,
      username: input.username,
      passwordHash: hashPassword(input.password),
      role: input.role,
      isSalaried: input.isSalaried,
      departments: input.departments,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateUsernameError(input.username);
    }
    throw error;
  }
}

export interface UpdateEmployeeInput {
  id: number;
  name: string;
  role: Role;
  isSalaried: boolean;
  isActive: boolean;
  password?: string;
}

export function updateEmployee(input: UpdateEmployeeInput): EmployeeWithDepartmentsRow {
  return employeeRepo.update({
    id: input.id,
    name: input.name,
    role: input.role,
    isSalaried: input.isSalaried,
    isActive: input.isActive,
    passwordHash: input.password ? hashPassword(input.password) : undefined,
  });
}

export function deactivateEmployee(id: number): EmployeeWithDepartmentsRow {
  return employeeRepo.deactivate(id);
}

export function setEmployeeDepartments(
  id: number,
  departments: Department[],
): EmployeeWithDepartmentsRow {
  return employeeRepo.setDepartments(id, departments);
}

export interface UpdateOwnProfileInput {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Self-service counterpart to `updateEmployee` — lets ANY logged-in actor
 * (employee or manager) update their OWN display name and/or password.
 * Deliberately narrower than the manager-only path above: it can never touch
 * role/departments/isSalaried/isActive.
 *
 * Changing the password additionally requires the caller to submit their
 * CURRENT password, verified via bcrypt against the stored hash, before the
 * new one is accepted — this app runs on a shared store computer as well as
 * personal phones, so a session left open must not let someone walk up and
 * silently take over the account by just typing a new password. Reuses
 * `InvalidCredentialsError` from authService (rather than a new error class)
 * for both "no current password supplied" and "current password doesn't
 * match" — from the caller's perspective both are simply "you didn't prove
 * you're still you".
 */
export function updateOwnProfile(
  actorId: number,
  input: UpdateOwnProfileInput,
): EmployeeWithDepartmentsRow {
  let passwordHash: string | undefined;
  if (input.newPassword !== undefined) {
    const actor = employeeRepo.findById(actorId);
    if (
      !actor ||
      !input.currentPassword ||
      !verifyPassword(input.currentPassword, actor.passwordHash)
    ) {
      throw new InvalidCredentialsError();
    }
    passwordHash = hashPassword(input.newPassword);
  }

  return employeeRepo.updateOwnProfile({
    id: actorId,
    name: input.name,
    passwordHash,
  });
}
