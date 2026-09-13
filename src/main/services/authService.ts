import bcrypt from 'bcryptjs';
import * as employeeRepo from '../db/repositories/employeeRepo';
import type { Employee } from '../../shared/types/domain';

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
export function login(username: string, password: string): Employee {
  const employee = employeeRepo.findByUsername(username);
  if (!employee || !employee.isActive) {
    throw new InvalidCredentialsError();
  }
  if (!verifyPassword(password, employee.passwordHash)) {
    throw new InvalidCredentialsError();
  }
  const { passwordHash, ...rest } = employee;
  return rest;
}

export function isFirstRun(): boolean {
  return employeeRepo.countEmployees() === 0;
}

/**
 * Creates the very first manager account. Only allowed when the employees
 * table is empty — this is the one path that can create an account without
 * an existing manager being logged in.
 */
export function createFirstManager(name: string, username: string, password: string): Employee {
  if (!isFirstRun()) {
    throw new FirstRunAlreadyCompleteError();
  }
  const created = employeeRepo.create({
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
