import { describe, expect, it } from 'vitest';
import type {
  EmployeeUnavailability,
  ScheduledShift,
  TimeOffRequest,
} from '../../../src/shared/types/domain';
import { buildMyScheduleDays } from '../../../src/shared/logic/myScheduleDay';
import type { MyScheduleDayInput } from '../../../src/shared/logic/myScheduleDay';
import type { ResolvedHours } from '../../../src/shared/logic/hoursResolution';

const OPEN_HOURS: ResolvedHours = {
  openTime: '09:00',
  closeTime: '22:00',
  isClosed: false,
  isOverride: false,
};

function makeDays(dates: string[]): MyScheduleDayInput[] {
  return dates.map((date) => ({ date, label: date, hours: OPEN_HOURS }));
}

function makeShift(overrides: Partial<ScheduledShift> = {}): ScheduledShift {
  return {
    id: 1,
    employeeId: 1,
    department: 'front_desk',
    shiftDate: '2026-09-14', // Monday
    startTime: '09:00',
    endTime: '17:00',
    startAnchor: 'fixed',
    endAnchor: 'fixed',
    templateId: null,
    isOverride: false,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTimeOff(overrides: Partial<TimeOffRequest> = {}): TimeOffRequest {
  return {
    id: 1,
    employeeId: 1,
    startDate: '2026-09-15',
    endDate: '2026-09-15',
    reason: null,
    status: 'approved',
    decidedBy: 2,
    decidedAt: '2026-01-01T00:00:00.000Z',
    decisionNote: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeUnavailability(overrides: Partial<EmployeeUnavailability> = {}): EmployeeUnavailability {
  return {
    id: 1,
    employeeId: 1,
    dayOfWeek: 3, // Wednesday, matches 2026-09-16 below
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

// Monday 2026-09-14 through Sunday 2026-09-20.
const WEEK_DATES = [
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
  '2026-09-19',
  '2026-09-20',
];

describe('buildMyScheduleDays', () => {
  it('places a shift on its own date and leaves every other day empty', () => {
    const shift = makeShift();
    const days = buildMyScheduleDays(makeDays(WEEK_DATES), 1, [shift], [], []);

    const mondayResult = days.find((day) => day.date === '2026-09-14');
    expect(mondayResult?.shifts).toEqual([shift]);
    days
      .filter((day) => day.date !== '2026-09-14')
      .forEach((day) => expect(day.shifts).toEqual([]));
  });

  it('ignores shifts belonging to other employees', () => {
    const otherEmployeeShift = makeShift({ employeeId: 2 });
    const days = buildMyScheduleDays(makeDays(WEEK_DATES), 1, [otherEmployeeShift], [], []);
    expect(days.every((day) => day.shifts.length === 0)).toBe(true);
  });

  it('includes shifts across every department, not just one', () => {
    const frontDeskShift = makeShift({ id: 1, department: 'front_desk' });
    const barShift = makeShift({ id: 2, department: 'bar' });
    const days = buildMyScheduleDays(
      makeDays(WEEK_DATES),
      1,
      [frontDeskShift, barShift],
      [],
      [],
    );
    const monday = days.find((day) => day.date === '2026-09-14');
    expect(monday?.shifts).toHaveLength(2);
    expect(monday?.shifts.map((shift) => shift.department).sort()).toEqual(['bar', 'front_desk']);
  });

  it('sorts multiple same-day shifts earliest start time first', () => {
    const afternoon = makeShift({ id: 1, startTime: '14:00' });
    const morning = makeShift({ id: 2, startTime: '08:00' });
    const days = buildMyScheduleDays(makeDays(WEEK_DATES), 1, [afternoon, morning], [], []);
    const monday = days.find((day) => day.date === '2026-09-14');
    expect(monday?.shifts.map((shift) => shift.id)).toEqual([2, 1]);
  });

  it('flags a day as approved time off only when an APPROVED request covers it', () => {
    const approved = makeTimeOff({ id: 1, startDate: '2026-09-15', endDate: '2026-09-15' });
    const pending = makeTimeOff({ id: 2, status: 'pending', startDate: '2026-09-16', endDate: '2026-09-16' });
    const days = buildMyScheduleDays(makeDays(WEEK_DATES), 1, [], [approved, pending], []);

    expect(days.find((day) => day.date === '2026-09-15')?.isApprovedTimeOff).toBe(true);
    expect(days.find((day) => day.date === '2026-09-16')?.isApprovedTimeOff).toBe(false);
  });

  it("ignores another employee's approved time off", () => {
    const otherEmployeeTimeOff = makeTimeOff({ employeeId: 2 });
    const days = buildMyScheduleDays(makeDays(WEEK_DATES), 1, [], [otherEmployeeTimeOff], []);
    expect(days.every((day) => !day.isApprovedTimeOff)).toBe(true);
  });

  it('spans a multi-day time-off request across every date it covers', () => {
    const weekendOff = makeTimeOff({ startDate: '2026-09-19', endDate: '2026-09-20' });
    const days = buildMyScheduleDays(makeDays(WEEK_DATES), 1, [], [weekendOff], []);
    expect(days.find((day) => day.date === '2026-09-19')?.isApprovedTimeOff).toBe(true);
    expect(days.find((day) => day.date === '2026-09-20')?.isApprovedTimeOff).toBe(true);
    expect(days.find((day) => day.date === '2026-09-18')?.isApprovedTimeOff).toBe(false);
  });

  it('matches approved unavailability to every date sharing its day of week, and only that day', () => {
    // 2026-09-16 is a Wednesday (dayOfWeek 3).
    const wednesdayOff = makeUnavailability({ dayOfWeek: 3 });
    const days = buildMyScheduleDays(makeDays(WEEK_DATES), 1, [], [], [wednesdayOff]);
    expect(days.find((day) => day.date === '2026-09-16')?.unavailability).toEqual([wednesdayOff]);
    expect(days.find((day) => day.date === '2026-09-14')?.unavailability).toEqual([]);
  });

  it('excludes pending/denied unavailability entries', () => {
    const pending = makeUnavailability({ status: 'pending' });
    const days = buildMyScheduleDays(makeDays(WEEK_DATES), 1, [], [], [pending]);
    expect(days.every((day) => day.unavailability.length === 0)).toBe(true);
  });

  it('carries the input label/hours through untouched', () => {
    const days = buildMyScheduleDays(makeDays(['2026-09-14']), 1, [], [], []);
    expect(days[0]).toMatchObject({ date: '2026-09-14', label: '2026-09-14', hours: OPEN_HOURS });
  });
});
