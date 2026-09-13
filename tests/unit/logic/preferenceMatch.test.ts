import { describe, expect, it } from 'vitest';
import { matchPreference } from '../../../src/shared/logic/preferenceMatch';
import type { EmployeePreference } from '../../../src/shared/types/domain';

let nextId = 1;

function makePreference(
  overrides: Partial<EmployeePreference> & Pick<EmployeePreference, 'dayOfWeek'>,
): EmployeePreference {
  const id = nextId;
  nextId += 1;
  return {
    id,
    employeeId: 1,
    preferredStartTime: '08:00',
    preferredEndTime: '12:00',
    note: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('matchPreference', () => {
  it('returns "none" when the employee has stated no preference for that day at all', () => {
    const preferences = [makePreference({ dayOfWeek: 2 })]; // Tuesday only
    expect(matchPreference('09:00', '12:00', 1, preferences)).toBe('none'); // Monday
  });

  it('returns "matches" when the shift falls entirely within the preferred window', () => {
    const preferences = [
      makePreference({ dayOfWeek: 1, preferredStartTime: '08:00', preferredEndTime: '14:00' }),
    ];
    expect(matchPreference('09:00', '12:00', 1, preferences)).toBe('matches');
  });

  it('returns "matches" when the shift exactly equals the preferred window', () => {
    const preferences = [
      makePreference({ dayOfWeek: 1, preferredStartTime: '08:00', preferredEndTime: '14:00' }),
    ];
    expect(matchPreference('08:00', '14:00', 1, preferences)).toBe('matches');
  });

  it('returns "partial" when the shift only partially overlaps the preferred window', () => {
    const preferences = [
      makePreference({ dayOfWeek: 1, preferredStartTime: '08:00', preferredEndTime: '12:00' }),
    ];
    expect(matchPreference('10:00', '16:00', 1, preferences)).toBe('partial');
  });

  it('returns "outside" when the shift does not overlap the preferred window at all', () => {
    const preferences = [
      makePreference({ dayOfWeek: 1, preferredStartTime: '08:00', preferredEndTime: '12:00' }),
    ];
    expect(matchPreference('16:00', '22:00', 1, preferences)).toBe('outside');
  });

  it('matches against any one of several windows stated for the same day', () => {
    const preferences = [
      makePreference({ dayOfWeek: 1, preferredStartTime: '08:00', preferredEndTime: '10:00' }),
      makePreference({ dayOfWeek: 1, preferredStartTime: '16:00', preferredEndTime: '20:00' }),
    ];
    expect(matchPreference('16:30', '19:30', 1, preferences)).toBe('matches');
  });

  it('treats a preference row with no times stated as not a real window for that day', () => {
    const preferences = [
      makePreference({ dayOfWeek: 1, preferredStartTime: null, preferredEndTime: null }),
    ];
    expect(matchPreference('09:00', '12:00', 1, preferences)).toBe('none');
  });

  describe('midnight-crossing shifts (regression)', () => {
    // Bug found while hardening this module for Milestone 12: the previous
    // implementation compared `HH:mm` strings directly (`shiftEnd <=
    // window.preferredEndTime`), which is only valid for same-day ranges. An
    // overnight shift's end time (e.g. "01:00") sorts LOWER than almost any
    // same-day time as a plain string, so it was incorrectly treated as
    // "earlier" than the end of a same-day preference window — e.g. a
    // 23:00-01:00 graveyard shift was reported as fully "matching" a
    // 09:00-17:00 daytime-only preference, purely because "01:00" < "17:00"
    // lexically. Fixed by routing through `shiftMath`'s minutes-since-
    // midnight + midnight-crossing convention, the same one
    // `overlapDetection`/`hoursResolution` already use.
    it('does NOT report an overnight shift as matching (or even partially overlapping) a same-day daytime-only preference window', () => {
      const preferences = [
        makePreference({ dayOfWeek: 5, preferredStartTime: '09:00', preferredEndTime: '17:00' }),
      ];
      // A 23:00-01:00 shift shares no actual wall-clock time with 09:00-17:00.
      expect(matchPreference('23:00', '01:00', 5, preferences)).toBe('outside');
    });

    it('correctly matches an overnight shift fully contained within an overnight preference window', () => {
      const preferences = [
        makePreference({ dayOfWeek: 5, preferredStartTime: '22:00', preferredEndTime: '02:00' }),
      ];
      expect(matchPreference('23:00', '01:00', 5, preferences)).toBe('matches');
    });

    it('correctly reports only a partial overlap when an overnight shift extends past an overnight preference window', () => {
      const preferences = [
        makePreference({ dayOfWeek: 5, preferredStartTime: '22:00', preferredEndTime: '02:00' }),
      ];
      // Shift runs 23:00 to 03:00 — an hour past the preferred window's 02:00 end.
      expect(matchPreference('23:00', '03:00', 5, preferences)).toBe('partial');
    });
  });
});
