import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as specialEventRepo from '../../../../server/src/db/repositories/specialEventRepo.js';

beforeEach(async () => {
  await truncateAllTables();
});

describe('specialEventRepo', () => {
  it('creates an override with custom hours and a label', async () => {
    const created = await specialEventRepo.create({
      eventDate: '2026-09-20',
      label: 'League Night',
      isClosed: false,
      openTime: '08:00',
      closeTime: '22:00',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.eventDate).toBe('2026-09-20');
    expect(created.label).toBe('League Night');
    expect(created.openTime).toBe('08:00');
    expect(created.closeTime).toBe('22:00');
    expect(created.isClosed).toBe(false);
  });

  it('nulls out open/close times when the override is fully closed', async () => {
    const created = await specialEventRepo.create({
      eventDate: '2026-09-20',
      label: 'Private Party',
      isClosed: true,
      openTime: '08:00',
      closeTime: '22:00',
    });

    expect(created.isClosed).toBe(true);
    expect(created.openTime).toBeNull();
    expect(created.closeTime).toBeNull();
  });

  it('lists overrides ordered by date', async () => {
    await specialEventRepo.create({
      eventDate: '2026-10-01',
      label: 'B',
      isClosed: false,
      openTime: '10:00',
      closeTime: '22:00',
    });
    await specialEventRepo.create({
      eventDate: '2026-09-15',
      label: 'A',
      isClosed: false,
      openTime: '10:00',
      closeTime: '22:00',
    });

    const all = await specialEventRepo.listAll();
    expect(all.map((event) => event.eventDate)).toEqual(['2026-09-15', '2026-10-01']);
  });

  it('finds an override by its exact date, and returns undefined when there is none', async () => {
    await specialEventRepo.create({
      eventDate: '2026-09-15',
      label: 'A',
      isClosed: false,
      openTime: '10:00',
      closeTime: '22:00',
    });

    expect((await specialEventRepo.getByDate('2026-09-15'))?.label).toBe('A');
    expect(await specialEventRepo.getByDate('2026-09-16')).toBeUndefined();
  });

  it('rejects a second override on the same date at the database level', async () => {
    await specialEventRepo.create({
      eventDate: '2026-09-15',
      label: 'A',
      isClosed: false,
      openTime: '10:00',
      closeTime: '22:00',
    });

    await expect(
      specialEventRepo.create({
        eventDate: '2026-09-15',
        label: 'B',
        isClosed: false,
        openTime: '11:00',
        closeTime: '20:00',
      }),
    ).rejects.toThrow();
  });

  it('updates an existing override in place', async () => {
    const created = await specialEventRepo.create({
      eventDate: '2026-09-15',
      label: 'A',
      isClosed: false,
      openTime: '10:00',
      closeTime: '22:00',
    });

    const updated = await specialEventRepo.update({
      id: created.id,
      eventDate: '2026-09-16',
      label: 'Updated Label',
      isClosed: false,
      openTime: '09:00',
      closeTime: '21:00',
    });

    expect(updated.eventDate).toBe('2026-09-16');
    expect(updated.label).toBe('Updated Label');
    expect(updated.openTime).toBe('09:00');
  });

  it('deletes an override by id', async () => {
    const created = await specialEventRepo.create({
      eventDate: '2026-09-15',
      label: 'A',
      isClosed: false,
      openTime: '10:00',
      closeTime: '22:00',
    });

    await specialEventRepo.remove(created.id);

    expect(await specialEventRepo.getById(created.id)).toBeUndefined();
    expect(await specialEventRepo.listAll()).toHaveLength(0);
  });
});
