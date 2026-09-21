import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as schedulePublicationRepo from '../../../../server/src/db/repositories/schedulePublicationRepo.js';

let managerId: number;

beforeEach(async () => {
  await truncateAllTables();

  const manager = await employeeRepo.create({
    name: 'Jesse Manager',
    username: `jesse-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: true,
    isSecretaryTagged: false,
    departments: [],
  });
  managerId = manager.id;
});

describe('schedulePublicationRepo', () => {
  it('reports unpublished when no publication row exists', async () => {
    expect(await schedulePublicationRepo.isPublished('front_desk', '2026-09-07')).toBe(false);
    expect(await schedulePublicationRepo.getPublication('front_desk', '2026-09-07')).toBeUndefined();
  });

  it('publishes a department/week and reads it back', async () => {
    const published = await schedulePublicationRepo.publish(
      'front_desk',
      '2026-09-07',
      managerId,
    );

    expect(published.department).toBe('front_desk');
    expect(published.weekStart).toBe('2026-09-07');
    expect(published.publishedByEmployeeId).toBe(managerId);
    expect(published.publishedAt).toEqual(expect.any(String));
    expect(await schedulePublicationRepo.isPublished('front_desk', '2026-09-07')).toBe(true);
  });

  it('keeps departments and weeks independent', async () => {
    await schedulePublicationRepo.publish('front_desk', '2026-09-07', managerId);

    expect(await schedulePublicationRepo.isPublished('bar', '2026-09-07')).toBe(false);
    expect(await schedulePublicationRepo.isPublished('front_desk', '2026-09-14')).toBe(false);
  });

  it('re-publishing the same department/week upserts rather than duplicating', async () => {
    const first = await schedulePublicationRepo.publish('front_desk', '2026-09-07', managerId);

    const secondManager = await employeeRepo.create({
      name: 'Alex Manager',
      username: `alex-${Date.now()}-${Math.random()}`,
      passwordHash: 'hash',
      role: 'manager',
      isSalaried: true,
      isSecretaryTagged: false,
      departments: [],
    });
    const second = await schedulePublicationRepo.publish(
      'front_desk',
      '2026-09-07',
      secondManager.id,
    );

    expect(second.id).toBe(first.id);
    expect(second.publishedByEmployeeId).toBe(secondManager.id);
  });

  it('unpublishes a published week', async () => {
    await schedulePublicationRepo.publish('front_desk', '2026-09-07', managerId);

    await schedulePublicationRepo.unpublish('front_desk', '2026-09-07');

    expect(await schedulePublicationRepo.isPublished('front_desk', '2026-09-07')).toBe(false);
  });

  it('unpublishing a never-published week is a no-op', async () => {
    await expect(
      schedulePublicationRepo.unpublish('front_desk', '2026-09-07'),
    ).resolves.toBeUndefined();
  });
});
