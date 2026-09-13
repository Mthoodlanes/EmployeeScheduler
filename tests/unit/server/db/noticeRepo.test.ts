import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as noticeRepo from '../../../../server/src/db/repositories/noticeRepo.js';

let posterId: number;

beforeEach(async () => {
  await truncateAllTables();
  const poster = await employeeRepo.create({
    name: 'Jesse Manager',
    username: `jesse-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: true,
    departments: [],
  });
  posterId = poster.id;
});

describe('noticeRepo', () => {
  it('creates a notice with no expiration and resolves the poster name via the join', async () => {
    const created = await noticeRepo.create({
      title: 'New special',
      body: 'Tuesday Taco Night',
      postedByEmployeeId: posterId,
      expiresAt: null,
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.title).toBe('New special');
    expect(created.postedByEmployeeId).toBe(posterId);
    expect(created.postedByName).toBe('Jesse Manager');
    expect(created.expiresAt).toBeNull();
  });

  it('creates a notice with an expiration date', async () => {
    const created = await noticeRepo.create({
      title: 'League night',
      body: 'Extended hours',
      postedByEmployeeId: posterId,
      expiresAt: '2026-09-25',
    });

    expect(created.expiresAt).not.toBeNull();
    expect(created.expiresAt?.slice(0, 10)).toBe('2026-09-25');
  });

  it('lists notices newest first', async () => {
    const first = await noticeRepo.create({
      title: 'First',
      body: 'Body',
      postedByEmployeeId: posterId,
      expiresAt: null,
    });
    const second = await noticeRepo.create({
      title: 'Second',
      body: 'Body',
      postedByEmployeeId: posterId,
      expiresAt: null,
    });

    const all = await noticeRepo.listAll();
    expect(all.map((n) => n.id)).toEqual([second.id, first.id]);
  });

  it('finds a notice by id, and returns undefined when there is none', async () => {
    const created = await noticeRepo.create({
      title: 'Findable',
      body: 'Body',
      postedByEmployeeId: posterId,
      expiresAt: null,
    });

    expect((await noticeRepo.getById(created.id))?.title).toBe('Findable');
    expect(await noticeRepo.getById(999999)).toBeUndefined();
  });

  it('updates an existing notice in place, including clearing an expiration', async () => {
    const created = await noticeRepo.create({
      title: 'Original',
      body: 'Original body',
      postedByEmployeeId: posterId,
      expiresAt: '2026-09-25',
    });

    const updated = await noticeRepo.update({
      id: created.id,
      title: 'Updated',
      body: 'Updated body',
      expiresAt: null,
    });

    expect(updated.title).toBe('Updated');
    expect(updated.expiresAt).toBeNull();
  });

  it('deletes a notice by id', async () => {
    const created = await noticeRepo.create({
      title: 'To remove',
      body: 'Body',
      postedByEmployeeId: posterId,
      expiresAt: null,
    });

    await noticeRepo.remove(created.id);

    expect(await noticeRepo.getById(created.id)).toBeUndefined();
    expect(await noticeRepo.listAll()).toHaveLength(0);
  });

  describe('getLatestActiveCreatedAt', () => {
    it('returns null when there are no notices at all', async () => {
      expect(await noticeRepo.getLatestActiveCreatedAt()).toBeNull();
    });

    it('returns the newest notice\'s createdAt when none are expired', async () => {
      await noticeRepo.create({
        title: 'First',
        body: 'Body',
        postedByEmployeeId: posterId,
        expiresAt: null,
      });
      const second = await noticeRepo.create({
        title: 'Second',
        body: 'Body',
        postedByEmployeeId: posterId,
        expiresAt: null,
      });

      const latest = await noticeRepo.getLatestActiveCreatedAt();
      expect(latest?.toISOString()).toBe(second.createdAt);
    });

    it('ignores an expired notice even if it is the newest one', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const active = await noticeRepo.create({
        title: 'Still active',
        body: 'Body',
        postedByEmployeeId: posterId,
        expiresAt: null,
      });
      await noticeRepo.create({
        title: 'Expired but newer',
        body: 'Body',
        postedByEmployeeId: posterId,
        expiresAt: yesterday,
      });

      const latest = await noticeRepo.getLatestActiveCreatedAt();
      expect(latest?.toISOString()).toBe(active.createdAt);
    });
  });
});
