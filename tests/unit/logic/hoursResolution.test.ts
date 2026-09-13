import { describe, expect, it } from 'vitest';
import {
  resolveHoursForDate,
  resolveShiftTime,
  resolveShiftTimeFromHours,
} from '../../../src/shared/logic/hoursResolution';
import type { SpecialEventOverride, StoreHours } from '../../../src/shared/types/domain';

function makeStoreHours(overrides: Partial<StoreHours> = {}): StoreHours {
  return {
    id: 1,
    dayOfWeek: 6, // Saturday
    openTime: '10:00',
    closeTime: '22:00',
    isClosed: false,
    ...overrides,
  };
}

function makeOverride(overrides: Partial<SpecialEventOverride> = {}): SpecialEventOverride {
  return {
    id: 1,
    eventDate: '2026-09-12',
    label: 'League Night',
    isClosed: false,
    openTime: '08:00',
    closeTime: '22:00',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveHoursForDate', () => {
  it('falls back to the weekly default when there is no override for the date', () => {
    // 2026-09-12 is a Saturday.
    const storeHours = [makeStoreHours({ dayOfWeek: 6, openTime: '10:00', closeTime: '22:00' })];

    const result = resolveHoursForDate('2026-09-12', storeHours, []);

    expect(result).toEqual({
      openTime: '10:00',
      closeTime: '22:00',
      isClosed: false,
      isOverride: false,
    });
  });

  it('lets an override on the exact date win even when it sets different hours than the default', () => {
    const storeHours = [makeStoreHours({ dayOfWeek: 6, openTime: '10:00', closeTime: '22:00' })];
    const overrides = [
      makeOverride({
        eventDate: '2026-09-12',
        label: 'League Night',
        openTime: '08:00',
        closeTime: '22:00',
      }),
    ];

    const result = resolveHoursForDate('2026-09-12', storeHours, overrides);

    expect(result).toEqual({
      openTime: '08:00',
      closeTime: '22:00',
      isClosed: false,
      label: 'League Night',
      isOverride: true,
    });
  });

  it('suppresses hours entirely when the override marks the date fully closed, even if the weekly default is open', () => {
    const storeHours = [
      makeStoreHours({ dayOfWeek: 6, openTime: '10:00', closeTime: '22:00', isClosed: false }),
    ];
    const overrides = [
      makeOverride({
        eventDate: '2026-09-12',
        label: 'Private Party — Closed to Public',
        isClosed: true,
        openTime: null,
        closeTime: null,
      }),
    ];

    const result = resolveHoursForDate('2026-09-12', storeHours, overrides);

    expect(result.isClosed).toBe(true);
    expect(result.openTime).toBeNull();
    expect(result.closeTime).toBeNull();
    expect(result.isOverride).toBe(true);
    expect(result.label).toBe('Private Party — Closed to Public');
  });

  it('ignores an override open/close time when isClosed is true, even if the row still carries stale times', () => {
    const overrides = [
      makeOverride({
        eventDate: '2026-09-12',
        isClosed: true,
        openTime: '08:00',
        closeTime: '22:00',
      }),
    ];

    const result = resolveHoursForDate('2026-09-12', [], overrides);

    expect(result.isClosed).toBe(true);
    expect(result.openTime).toBeNull();
    expect(result.closeTime).toBeNull();
  });

  it('treats a weekly-closed day as closed with no hours when there is no override', () => {
    const storeHours = [
      makeStoreHours({ dayOfWeek: 6, isClosed: true, openTime: null, closeTime: null }),
    ];

    const result = resolveHoursForDate('2026-09-12', storeHours, []);

    expect(result).toEqual({
      openTime: null,
      closeTime: null,
      isClosed: true,
      isOverride: false,
    });
  });

  it('treats a date with no override and no weekly-default row configured for that day-of-week as closed/unknown, without throwing', () => {
    // No store_hours row at all for Saturday (dayOfWeek 6).
    const storeHours = [makeStoreHours({ dayOfWeek: 1 })]; // only Monday configured

    expect(() => resolveHoursForDate('2026-09-12', storeHours, [])).not.toThrow();
    const result = resolveHoursForDate('2026-09-12', storeHours, []);

    expect(result).toEqual({
      openTime: null,
      closeTime: null,
      isClosed: true,
      isOverride: false,
    });
  });

  it('resolves correctly with both storeHours and overrides entirely empty', () => {
    const result = resolveHoursForDate('2026-09-12', [], []);
    expect(result.isClosed).toBe(true);
    expect(result.isOverride).toBe(false);
  });
});

describe('resolveShiftTime', () => {
  const storeHours = [makeStoreHours({ dayOfWeek: 6, openTime: '10:00', closeTime: '22:00' })];

  it('returns the literal time as-is for a fixed anchor, ignoring storeHours entirely', () => {
    expect(resolveShiftTime('fixed', '14:00', '2026-09-12', storeHours, [])).toBe('14:00');
    // Even with no storeHours/overrides data at all, a fixed anchor never needs to resolve anything.
    expect(resolveShiftTime('fixed', '14:00', '2026-09-12', [], [])).toBe('14:00');
  });

  it('resolves an "open" anchor against the normal weekly hours', () => {
    expect(resolveShiftTime('open', null, '2026-09-12', storeHours, [])).toBe('10:00');
  });

  it('resolves a "close" anchor against the normal weekly hours', () => {
    expect(resolveShiftTime('close', null, '2026-09-12', storeHours, [])).toBe('22:00');
  });

  it('resolves a "close" anchor against a special-event override on that exact date, not the weekly default', () => {
    const overrides = [
      makeOverride({
        eventDate: '2026-09-12',
        label: 'League Night',
        openTime: '08:00',
        closeTime: '23:30',
      }),
    ];

    expect(resolveShiftTime('close', null, '2026-09-12', storeHours, overrides)).toBe('23:30');
    expect(resolveShiftTime('open', null, '2026-09-12', storeHours, overrides)).toBe('08:00');
  });

  it('does not let a special-event override on a DIFFERENT date affect resolution', () => {
    const overrides = [
      makeOverride({
        eventDate: '2026-09-13',
        label: 'League Night',
        openTime: '08:00',
        closeTime: '23:30',
      }),
    ];

    expect(resolveShiftTime('close', null, '2026-09-12', storeHours, overrides)).toBe('22:00');
  });

  it('returns null for an anchored edge when the day resolves to fully closed', () => {
    const closedStoreHours = [
      makeStoreHours({ dayOfWeek: 6, isClosed: true, openTime: null, closeTime: null }),
    ];

    expect(resolveShiftTime('close', null, '2026-09-12', closedStoreHours, [])).toBeNull();
    expect(resolveShiftTime('open', null, '2026-09-12', closedStoreHours, [])).toBeNull();
  });

  it('returns null for an anchored edge when a special-event override marks the date fully closed', () => {
    const overrides = [
      makeOverride({ eventDate: '2026-09-12', isClosed: true, openTime: null, closeTime: null }),
    ];

    expect(resolveShiftTime('close', null, '2026-09-12', storeHours, overrides)).toBeNull();
  });
});

describe('resolveShiftTimeFromHours', () => {
  it('mirrors resolveShiftTime but takes already-resolved hours, for callers that have them (e.g. the schedule grid)', () => {
    const hours = resolveHoursForDate('2026-09-12', [makeStoreHours({ dayOfWeek: 6 })], []);
    expect(resolveShiftTimeFromHours('close', null, hours)).toBe('22:00');
    expect(resolveShiftTimeFromHours('fixed', '09:00', hours)).toBe('09:00');
  });

  it('returns null when the resolved hours are fully closed', () => {
    const hours = resolveHoursForDate('2026-09-12', [], []);
    expect(hours.isClosed).toBe(true);
    expect(resolveShiftTimeFromHours('open', null, hours)).toBeNull();
  });
});
