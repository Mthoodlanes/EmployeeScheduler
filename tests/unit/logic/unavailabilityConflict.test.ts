import { describe, expect, it } from 'vitest';
import type { EmployeeUnavailability } from '../../../src/shared/types/domain';
import {
  findUnavailabilityConflicts,
  findUnavailabilityForDay,
  isFullDayUnavailability,
} from '../../../src/shared/logic/unavailabilityConflict';

function makeEntry(overrides: Partial<EmployeeUnavailability> = {}): EmployeeUnavailability {
  return {
    id: 1,
    employeeId: 1,
    dayOfWeek: 0,
    startTime: '00:00',
    endTime: '23:59',
    reason: null,
    status: 'approved',
    requestedBy: 1,
    decidedBy: 2,
    decidedAt: '2026-01-01T00:00:00.000Z',
    decisionNote: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('isFullDayUnavailability', () => {
  it('recognizes the 00:00-23:59 full-day convention', () => {
    expect(isFullDayUnavailability({ startTime: '00:00', endTime: '23:59' })).toBe(true);
  });

  it('treats any other window as not full-day', () => {
    expect(isFullDayUnavailability({ startTime: '09:00', endTime: '17:00' })).toBe(false);
    expect(isFullDayUnavailability({ startTime: '00:00', endTime: '12:00' })).toBe(false);
  });
});

describe('findUnavailabilityForDay', () => {
  it('returns only entries matching the given day of week, regardless of time', () => {
    const sunday = makeEntry({ id: 1, dayOfWeek: 0 });
    const monday = makeEntry({ id: 2, dayOfWeek: 1 });
    expect(findUnavailabilityForDay(0, [sunday, monday])).toEqual([sunday]);
  });

  it('returns an empty array when nothing matches the day', () => {
    const monday = makeEntry({ id: 1, dayOfWeek: 1 });
    expect(findUnavailabilityForDay(0, [monday])).toEqual([]);
  });
});

describe('findUnavailabilityConflicts', () => {
  it('finds no conflict when the employee has no unavailability at all', () => {
    expect(findUnavailabilityConflicts(0, '09:00', '17:00', [])).toEqual([]);
  });

  it('a full-day entry conflicts with any shift on that day', () => {
    const fullDay = makeEntry({ id: 1, dayOfWeek: 0, startTime: '00:00', endTime: '23:59' });
    expect(findUnavailabilityConflicts(0, '09:00', '10:00', [fullDay])).toEqual([fullDay]);
    expect(findUnavailabilityConflicts(0, '23:00', '23:30', [fullDay])).toEqual([fullDay]);
  });

  it('detects a partial-window overlap', () => {
    const eveningOff = makeEntry({ id: 1, dayOfWeek: 3, startTime: '18:00', endTime: '23:59' });
    // Shift 17:00-19:00 overlaps the 18:00-23:59 window.
    expect(findUnavailabilityConflicts(3, '17:00', '19:00', [eveningOff])).toEqual([eveningOff]);
  });

  it('does not flag a non-conflicting time window on the same day', () => {
    const eveningOff = makeEntry({ id: 1, dayOfWeek: 3, startTime: '18:00', endTime: '23:59' });
    // Shift entirely before the unavailability window starts.
    expect(findUnavailabilityConflicts(3, '09:00', '17:00', [eveningOff])).toEqual([]);
  });

  it('ignores entries on the wrong day of week even if the time would overlap', () => {
    const mondayEveningOff = makeEntry({ id: 1, dayOfWeek: 1, startTime: '18:00', endTime: '23:59' });
    // Same time window, but on Tuesday (2) instead of Monday (1).
    expect(findUnavailabilityConflicts(2, '18:00', '20:00', [mondayEveningOff])).toEqual([]);
  });

  it('only returns entries that actually conflict when several exist for the day', () => {
    const morningOff = makeEntry({ id: 1, dayOfWeek: 0, startTime: '06:00', endTime: '09:00' });
    const eveningOff = makeEntry({ id: 2, dayOfWeek: 0, startTime: '18:00', endTime: '23:59' });
    const results = findUnavailabilityConflicts(0, '17:00', '19:00', [morningOff, eveningOff]);
    expect(results).toEqual([eveningOff]);
  });

  it('correctly flags a midnight-crossing (overnight) shift against a late-evening unavailability window on its start day', () => {
    // Unavailable Friday evenings 22:00-23:59; a graveyard shift starting
    // Friday 22:00 and running to Saturday 02:00 is keyed to Friday (its
    // start day-of-week), same convention `overlapDetection`/scheduled
    // shifts use — timeRangesOverlap correctly treats the shift's 02:00 end
    // as next-day rather than "earlier than 22:00".
    const fridayEveningOff = makeEntry({ id: 1, dayOfWeek: 5, startTime: '22:00', endTime: '23:59' });
    expect(findUnavailabilityConflicts(5, '22:00', '02:00', [fridayEveningOff])).toEqual([
      fridayEveningOff,
    ]);
  });

  it('does not conflate an overnight shift with unavailability stated for the NEXT calendar day-of-week', () => {
    // The overnight shift above is still keyed entirely to Friday (its start
    // date) — a separate unavailability entry for Saturday mornings must not
    // be consulted for it at all, even though the shift physically extends
    // into Saturday morning. (Callers are expected to only pass the shift's
    // own start day-of-week, as this test does.)
    const saturdayMorningOff = makeEntry({ id: 2, dayOfWeek: 6, startTime: '00:00', endTime: '06:00' });
    expect(findUnavailabilityConflicts(5, '22:00', '02:00', [saturdayMorningOff])).toEqual([]);
  });
});
