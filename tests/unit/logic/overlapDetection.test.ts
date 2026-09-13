import { describe, expect, it } from 'vitest';
import { detectOverlaps } from '../../../src/shared/logic/overlapDetection';
import type { OverlapEmployee } from '../../../src/shared/logic/overlapDetection';
import type {
  ScheduledShift,
  SpecialEventOverride,
  StoreHours,
} from '../../../src/shared/types/domain';

let nextId = 1;

function makeShift(
  overrides: Partial<ScheduledShift> &
    Pick<ScheduledShift, 'employeeId' | 'department' | 'shiftDate' | 'startTime' | 'endTime'>,
): ScheduledShift {
  const id = nextId;
  nextId += 1;
  return {
    id,
    templateId: null,
    isOverride: false,
    notes: null,
    startAnchor: 'fixed',
    endAnchor: 'fixed',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeStoreHours(overrides: Partial<StoreHours> = {}): StoreHours {
  return {
    id: 1,
    dayOfWeek: 6, // Saturday — 2026-09-12 is a Saturday.
    openTime: '10:00',
    closeTime: '22:00',
    isClosed: false,
    ...overrides,
  };
}

function makeEventOverride(overrides: Partial<SpecialEventOverride> = {}): SpecialEventOverride {
  return {
    id: 1,
    eventDate: '2026-09-12',
    label: 'League Night — closes late',
    isClosed: false,
    openTime: '10:00',
    closeTime: '23:30',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const CASEY: OverlapEmployee = { id: 1, name: 'Casey Nguyen', isSalaried: false };
const JORDAN_SALARIED: OverlapEmployee = { id: 2, name: 'Jordan Blake', isSalaried: true };
const ALEX: OverlapEmployee = { id: 3, name: 'Alex Chen', isSalaried: false };

describe('detectOverlaps', () => {
  it('returns no warnings when an employee has a single shift for the day', () => {
    const shifts = [
      makeShift({
        employeeId: CASEY.id,
        department: 'cafe',
        shiftDate: '2026-09-11',
        startTime: '09:00',
        endTime: '14:00',
      }),
    ];
    expect(detectOverlaps(shifts, [CASEY])).toEqual([]);
  });

  it('does not flag shifts that only touch at an endpoint (one ends exactly when the other starts)', () => {
    const shifts = [
      makeShift({
        employeeId: CASEY.id,
        department: 'cafe',
        shiftDate: '2026-09-11',
        startTime: '09:00',
        endTime: '14:00',
      }),
      makeShift({
        employeeId: CASEY.id,
        department: 'bar',
        shiftDate: '2026-09-11',
        startTime: '14:00',
        endTime: '18:00',
      }),
    ];
    expect(detectOverlaps(shifts, [CASEY])).toEqual([]);
  });

  it('flags a true overlap across two different departments (the primary use case)', () => {
    const cafeShift = makeShift({
      employeeId: CASEY.id,
      department: 'cafe',
      shiftDate: '2026-09-12',
      startTime: '09:00',
      endTime: '14:00',
    });
    const barShift = makeShift({
      employeeId: CASEY.id,
      department: 'bar',
      shiftDate: '2026-09-12',
      startTime: '13:00',
      endTime: '18:00',
    });

    const warnings = detectOverlaps([cafeShift, barShift], [CASEY]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      employeeId: CASEY.id,
      employeeName: 'Casey Nguyen',
      date: '2026-09-12',
    });
    const departments = [warnings[0].shiftA.department, warnings[0].shiftB.department].sort();
    expect(departments).toEqual(['bar', 'cafe']);
  });

  it('flags a same-department double-booking', () => {
    const shiftA = makeShift({
      employeeId: ALEX.id,
      department: 'front_desk',
      shiftDate: '2026-09-13',
      startTime: '08:00',
      endTime: '14:00',
    });
    const shiftB = makeShift({
      employeeId: ALEX.id,
      department: 'front_desk',
      shiftDate: '2026-09-13',
      startTime: '12:00',
      endTime: '18:00',
    });

    const warnings = detectOverlaps([shiftA, shiftB], [ALEX]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].shiftA.department).toBe('front_desk');
    expect(warnings[0].shiftB.department).toBe('front_desk');
  });

  it('excludes a salaried employee entirely, even when their shifts clearly overlap', () => {
    const shiftA = makeShift({
      employeeId: JORDAN_SALARIED.id,
      department: 'cafe',
      shiftDate: '2026-09-14',
      startTime: '09:00',
      endTime: '15:00',
    });
    const shiftB = makeShift({
      employeeId: JORDAN_SALARIED.id,
      department: 'bar',
      shiftDate: '2026-09-14',
      startTime: '10:00',
      endTime: '20:00',
    });

    expect(detectOverlaps([shiftA, shiftB], [JORDAN_SALARIED])).toEqual([]);
  });

  it('produces all pairwise conflicts (not just one) when 3+ shifts for one employee mutually overlap', () => {
    const shiftA = makeShift({
      employeeId: CASEY.id,
      department: 'cafe',
      shiftDate: '2026-09-15',
      startTime: '09:00',
      endTime: '14:00',
    });
    const shiftB = makeShift({
      employeeId: CASEY.id,
      department: 'bar',
      shiftDate: '2026-09-15',
      startTime: '10:00',
      endTime: '16:00',
    });
    const shiftC = makeShift({
      employeeId: CASEY.id,
      department: 'front_desk',
      shiftDate: '2026-09-15',
      startTime: '12:00',
      endTime: '18:00',
    });

    const warnings = detectOverlaps([shiftA, shiftB, shiftC], [CASEY]);

    // 3 mutually-overlapping shifts -> C(3,2) = 3 pairwise warnings.
    expect(warnings).toHaveLength(3);
    const pairIds = warnings
      .map((w) => [w.shiftA.shiftId, w.shiftB.shiftId].sort().join('-'))
      .sort();
    expect(pairIds).toEqual(
      [
        [shiftA.id, shiftB.id].sort().join('-'),
        [shiftA.id, shiftC.id].sort().join('-'),
        [shiftB.id, shiftC.id].sort().join('-'),
      ].sort(),
    );
  });

  it('does not conflate different employees or different dates', () => {
    const shifts = [
      makeShift({
        employeeId: CASEY.id,
        department: 'cafe',
        shiftDate: '2026-09-11',
        startTime: '09:00',
        endTime: '14:00',
      }),
      makeShift({
        employeeId: ALEX.id,
        department: 'bar',
        shiftDate: '2026-09-11',
        startTime: '10:00',
        endTime: '15:00',
      }),
      makeShift({
        employeeId: CASEY.id,
        department: 'bar',
        shiftDate: '2026-09-12',
        startTime: '10:00',
        endTime: '15:00',
      }),
    ];
    expect(detectOverlaps(shifts, [CASEY, ALEX])).toEqual([]);
  });

  it('documents current behavior: overlap detection has no concept of an inactive employee — a deactivated (non-salaried) employee\'s shifts are still flagged', () => {
    // `OverlapEmployee` intentionally carries only `id`/`name`/`isSalaried` —
    // active/inactive status is a roster-visibility concern the caller (the
    // schedule grid) handles separately by filtering which employees it
    // renders rows for; this module keeps warning about real double-bookings
    // regardless, since the underlying scheduled_shifts rows for a
    // deactivated employee are not deleted and could still need cleanup.
    const shiftA = makeShift({
      employeeId: CASEY.id,
      department: 'cafe',
      shiftDate: '2026-09-16',
      startTime: '09:00',
      endTime: '15:00',
    });
    const shiftB = makeShift({
      employeeId: CASEY.id,
      department: 'bar',
      shiftDate: '2026-09-16',
      startTime: '10:00',
      endTime: '18:00',
    });

    expect(detectOverlaps([shiftA, shiftB], [CASEY])).toHaveLength(1);
  });

  it('ignores a shift belonging to an employee id not present in the employee list', () => {
    const shifts = [
      makeShift({
        employeeId: 999,
        department: 'cafe',
        shiftDate: '2026-09-11',
        startTime: '09:00',
        endTime: '14:00',
      }),
      makeShift({
        employeeId: 999,
        department: 'bar',
        shiftDate: '2026-09-11',
        startTime: '10:00',
        endTime: '15:00',
      }),
    ];
    expect(detectOverlaps(shifts, [CASEY, ALEX])).toEqual([]);
  });

  describe('anchored ("2pm-Close" style) shifts', () => {
    it('resolves an anchored end time against the normal weekly close and flags a real conflict', () => {
      const storeHours = [makeStoreHours({ closeTime: '22:00' })];
      // Cafe: fixed 2pm-6pm. Bar: anchored 2pm-Close, which resolves to 22:00 -> overlaps the Cafe shift.
      const cafeShift = makeShift({
        employeeId: CASEY.id,
        department: 'cafe',
        shiftDate: '2026-09-12',
        startTime: '14:00',
        endTime: '18:00',
      });
      const barShift = makeShift({
        employeeId: CASEY.id,
        department: 'bar',
        shiftDate: '2026-09-12',
        startTime: '14:00',
        endTime: null,
        endAnchor: 'close',
      });

      const warnings = detectOverlaps([cafeShift, barShift], [CASEY], storeHours, []);
      expect(warnings).toHaveLength(1);
    });

    it('does not flag a conflict under normal hours, but DOES once a special event pushes closing time later into the other shift', () => {
      const storeHours = [makeStoreHours({ closeTime: '21:00' })];
      // A Bar shift 2pm-Close (resolves to 21:00 normally) and a Cafe shift 21:00-23:00 — back to back, no overlap.
      const barShift = makeShift({
        employeeId: CASEY.id,
        department: 'bar',
        shiftDate: '2026-09-12',
        startTime: '14:00',
        endTime: null,
        endAnchor: 'close',
      });
      const cafeShift = makeShift({
        employeeId: CASEY.id,
        department: 'cafe',
        shiftDate: '2026-09-12',
        startTime: '21:00',
        endTime: '23:00',
      });

      expect(detectOverlaps([barShift, cafeShift], [CASEY], storeHours, [])).toEqual([]);

      // A special event on that exact date extends closing to 22:00 -> the Bar
      // shift now resolves to 14:00-22:00, which overlaps the 21:00-23:00 Cafe shift.
      const overrides = [makeEventOverride({ eventDate: '2026-09-12', closeTime: '22:00' })];
      const warnings = detectOverlaps([barShift, cafeShift], [CASEY], storeHours, overrides);
      expect(warnings).toHaveLength(1);
      const departments = [warnings[0].shiftA.department, warnings[0].shiftB.department].sort();
      expect(departments).toEqual(['bar', 'cafe']);
    });

    it('flags a conflict between two shifts both anchored to close, resolved against the same date', () => {
      const storeHours = [makeStoreHours({ closeTime: '22:00' })];
      const shiftA = makeShift({
        employeeId: ALEX.id,
        department: 'front_desk',
        shiftDate: '2026-09-12',
        startTime: '18:00',
        endTime: null,
        endAnchor: 'close',
      });
      const shiftB = makeShift({
        employeeId: ALEX.id,
        department: 'bar',
        shiftDate: '2026-09-12',
        startTime: '19:00',
        endTime: null,
        endAnchor: 'close',
      });

      const warnings = detectOverlaps([shiftA, shiftB], [ALEX], storeHours, []);
      expect(warnings).toHaveLength(1);
    });

    it('excludes an anchored shift from comparison entirely when the store is fully closed that date, rather than crashing or guessing a time', () => {
      const storeHours = [makeStoreHours({ isClosed: true, openTime: null, closeTime: null })];
      const barShift = makeShift({
        employeeId: CASEY.id,
        department: 'bar',
        shiftDate: '2026-09-12',
        startTime: '14:00',
        endTime: null,
        endAnchor: 'close',
      });
      const cafeShift = makeShift({
        employeeId: CASEY.id,
        department: 'cafe',
        shiftDate: '2026-09-12',
        startTime: '13:00',
        endTime: '20:00',
      });

      expect(() => detectOverlaps([barShift, cafeShift], [CASEY], storeHours, [])).not.toThrow();
      expect(detectOverlaps([barShift, cafeShift], [CASEY], storeHours, [])).toEqual([]);
    });

    it('clears a previously-flagged conflict once a special event makes the store close EARLIER, not just later', () => {
      const storeHours = [makeStoreHours({ closeTime: '22:00' })];
      // Bar 6pm-Close (resolves to 22:00 normally) genuinely overlaps a Cafe
      // 9pm-11pm shift under normal hours.
      const barShift = makeShift({
        employeeId: CASEY.id,
        department: 'bar',
        shiftDate: '2026-09-12',
        startTime: '18:00',
        endTime: null,
        endAnchor: 'close',
      });
      const cafeShift = makeShift({
        employeeId: CASEY.id,
        department: 'cafe',
        shiftDate: '2026-09-12',
        startTime: '21:00',
        endTime: '23:00',
      });

      expect(detectOverlaps([barShift, cafeShift], [CASEY], storeHours, [])).toHaveLength(1);

      // A special event on that exact date closes EARLIER at 20:00 -> the Bar
      // shift now resolves to 18:00-20:00, entirely before the Cafe shift
      // starts at 21:00 -> the conflict clears.
      const overrides = [
        makeEventOverride({
          eventDate: '2026-09-12',
          label: 'Early close for private cleaning',
          openTime: '10:00',
          closeTime: '20:00',
        }),
      ];
      expect(detectOverlaps([barShift, cafeShift], [CASEY], storeHours, overrides)).toEqual([]);
    });

    it('correctly compares two anchored-to-close shifts when the resolved close time itself crosses midnight', () => {
      // Wednesday-style Mt Hood Lanes hours: 14:00-00:00 (closes at midnight).
      const storeHours = [makeStoreHours({ openTime: '14:00', closeTime: '00:00' })];
      // Front Desk: 8pm-Close -> resolves to 20:00-00:00(+24h).
      const frontDeskShift = makeShift({
        employeeId: ALEX.id,
        department: 'front_desk',
        shiftDate: '2026-09-12',
        startTime: '20:00',
        endTime: null,
        endAnchor: 'close',
      });
      // Bar: 11pm-Close -> resolves to 23:00-00:00(+24h) -> genuinely overlaps
      // the Front Desk shift from 23:00 to midnight.
      const barShift = makeShift({
        employeeId: ALEX.id,
        department: 'bar',
        shiftDate: '2026-09-12',
        startTime: '23:00',
        endTime: null,
        endAnchor: 'close',
      });

      const warnings = detectOverlaps([frontDeskShift, barShift], [ALEX], storeHours, []);
      expect(warnings).toHaveLength(1);
    });

    it('does not falsely flag two anchored-to-close shifts on the same midnight-crossing day when one ends before the other starts', () => {
      const storeHours = [makeStoreHours({ openTime: '14:00', closeTime: '00:00' })];
      // A fixed early shift that ends well before closing, and a late
      // anchored-to-close shift that starts exactly when the early one ends —
      // back-to-back, not overlapping, even though "Close" itself is a
      // midnight-crossing time on this store-hours row.
      const earlyShift = makeShift({
        employeeId: ALEX.id,
        department: 'front_desk',
        shiftDate: '2026-09-12',
        startTime: '14:00',
        endTime: '18:00',
      });
      const lateShift = makeShift({
        employeeId: ALEX.id,
        department: 'bar',
        shiftDate: '2026-09-12',
        startTime: '18:00',
        endTime: null,
        endAnchor: 'close',
      });

      expect(detectOverlaps([earlyShift, lateShift], [ALEX], storeHours, [])).toEqual([]);
    });

    it('a fixed/fixed shift compares correctly even with no storeHours/overrides arguments passed at all (backward compatible defaults)', () => {
      const shiftA = makeShift({
        employeeId: ALEX.id,
        department: 'front_desk',
        shiftDate: '2026-09-13',
        startTime: '08:00',
        endTime: '14:00',
      });
      const shiftB = makeShift({
        employeeId: ALEX.id,
        department: 'bar',
        shiftDate: '2026-09-13',
        startTime: '12:00',
        endTime: '18:00',
      });

      expect(detectOverlaps([shiftA, shiftB], [ALEX])).toHaveLength(1);
    });
  });
});
