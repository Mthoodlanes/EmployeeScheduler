import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import {
  InvalidCredentialsError,
  hashPassword,
  login,
  verifyPassword,
} from '../../../../server/src/services/authService.js';

beforeEach(async () => {
  await truncateAllTables();
  await employeeRepo.create({
    name: 'Test Manager',
    username: 'testmanager',
    passwordHash: hashPassword('correct-horse'),
    role: 'manager',
    isSalaried: false,
    departments: [],
  });
});

describe('authService password hashing', () => {
  it('hashes a password to a bcrypt digest distinct from the plaintext', () => {
    const hash = hashPassword('super-secret');
    expect(hash).not.toBe('super-secret');
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it('verifies a correct password against its own hash', () => {
    const hash = hashPassword('super-secret');
    expect(verifyPassword('super-secret', hash)).toBe(true);
  });

  it('rejects an incorrect password against the hash', () => {
    const hash = hashPassword('super-secret');
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces a different hash for the same password on each call (unique salt)', () => {
    const first = hashPassword('same-password');
    const second = hashPassword('same-password');
    expect(first).not.toBe(second);
  });
});

describe('authService.login', () => {
  it('returns the employee, without the password hash, on valid credentials', async () => {
    const employee = await login('testmanager', 'correct-horse');
    expect(employee.username).toBe('testmanager');
    expect(employee.role).toBe('manager');
    expect(employee).not.toHaveProperty('passwordHash');
  });

  it('throws InvalidCredentialsError for a wrong password', async () => {
    await expect(login('testmanager', 'wrong-password')).rejects.toThrow(InvalidCredentialsError);
  });

  it('throws InvalidCredentialsError for an unknown username', async () => {
    await expect(login('nobody', 'whatever')).rejects.toThrow(InvalidCredentialsError);
  });

  it('throws InvalidCredentialsError for a deactivated employee, even with the correct password', async () => {
    await employeeRepo.create({
      name: 'Former Employee',
      username: 'formeremployee',
      passwordHash: hashPassword('still-the-right-password'),
      role: 'employee',
      isSalaried: false,
      departments: [],
    });
    const created = await employeeRepo.findByUsername('formeremployee');
    await employeeRepo.deactivate(created!.id);

    await expect(login('formeremployee', 'still-the-right-password')).rejects.toThrow(
      InvalidCredentialsError,
    );
  });
});
