import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as pushSubscriptionRepo from '../../../../server/src/db/repositories/pushSubscriptionRepo.js';

let employeeId: number;
let otherEmployeeId: number;

beforeEach(async () => {
  await truncateAllTables();
  const employee = await employeeRepo.create({
    name: 'Employee One',
    username: `employee-one-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: [],
  });
  employeeId = employee.id;
  const other = await employeeRepo.create({
    name: 'Employee Two',
    username: `employee-two-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: [],
  });
  otherEmployeeId = other.id;
});

describe('pushSubscriptionRepo', () => {
  it('upserts a subscription and lists it back for its employee', async () => {
    await pushSubscriptionRepo.upsert(employeeId, {
      endpoint: 'https://push.example.com/one',
      p256dh: 'p256dh-key',
      auth: 'auth-key',
    });

    const subscriptions = await pushSubscriptionRepo.listForEmployees([employeeId]);
    expect(subscriptions).toEqual([
      {
        employeeId,
        endpoint: 'https://push.example.com/one',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      },
    ]);
  });

  it('re-upserting the same endpoint updates its keys and owner instead of duplicating the row', async () => {
    await pushSubscriptionRepo.upsert(employeeId, {
      endpoint: 'https://push.example.com/shared',
      p256dh: 'old-p256dh',
      auth: 'old-auth',
    });
    await pushSubscriptionRepo.upsert(otherEmployeeId, {
      endpoint: 'https://push.example.com/shared',
      p256dh: 'new-p256dh',
      auth: 'new-auth',
    });

    const forOriginalOwner = await pushSubscriptionRepo.listForEmployees([employeeId]);
    const forNewOwner = await pushSubscriptionRepo.listForEmployees([otherEmployeeId]);
    expect(forOriginalOwner).toEqual([]);
    expect(forNewOwner).toEqual([
      {
        employeeId: otherEmployeeId,
        endpoint: 'https://push.example.com/shared',
        p256dh: 'new-p256dh',
        auth: 'new-auth',
      },
    ]);
  });

  it('removes a subscription by endpoint', async () => {
    await pushSubscriptionRepo.upsert(employeeId, {
      endpoint: 'https://push.example.com/removable',
      p256dh: 'p256dh-key',
      auth: 'auth-key',
    });

    await pushSubscriptionRepo.removeByEndpoint('https://push.example.com/removable');

    expect(await pushSubscriptionRepo.listForEmployees([employeeId])).toEqual([]);
  });

  it('removes every subscription for an employee, leaving other employees untouched', async () => {
    await pushSubscriptionRepo.upsert(employeeId, {
      endpoint: 'https://push.example.com/a',
      p256dh: 'p256dh-a',
      auth: 'auth-a',
    });
    await pushSubscriptionRepo.upsert(employeeId, {
      endpoint: 'https://push.example.com/b',
      p256dh: 'p256dh-b',
      auth: 'auth-b',
    });
    await pushSubscriptionRepo.upsert(otherEmployeeId, {
      endpoint: 'https://push.example.com/c',
      p256dh: 'p256dh-c',
      auth: 'auth-c',
    });

    await pushSubscriptionRepo.removeAllForEmployee(employeeId);

    expect(await pushSubscriptionRepo.listForEmployees([employeeId])).toEqual([]);
    expect(await pushSubscriptionRepo.listForEmployees([otherEmployeeId])).toHaveLength(1);
  });

  it('returns an empty array without querying when given no employee ids', async () => {
    expect(await pushSubscriptionRepo.listForEmployees([])).toEqual([]);
  });

  it('lists subscriptions across multiple employees in one call', async () => {
    await pushSubscriptionRepo.upsert(employeeId, {
      endpoint: 'https://push.example.com/a',
      p256dh: 'p256dh-a',
      auth: 'auth-a',
    });
    await pushSubscriptionRepo.upsert(otherEmployeeId, {
      endpoint: 'https://push.example.com/b',
      p256dh: 'p256dh-b',
      auth: 'auth-b',
    });

    const subscriptions = await pushSubscriptionRepo.listForEmployees([
      employeeId,
      otherEmployeeId,
    ]);
    expect(subscriptions).toHaveLength(2);
    expect(subscriptions.map((s) => s.employeeId).sort()).toEqual(
      [employeeId, otherEmployeeId].sort(),
    );
  });
});
