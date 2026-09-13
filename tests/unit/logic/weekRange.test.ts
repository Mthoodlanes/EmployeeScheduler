import { describe, expect, it } from 'vitest';
import {
  formatDayLabel,
  formatWeekLabel,
  getWeekDates,
  getWeekStart,
  shiftWeek,
} from '../../../src/shared/logic/weekRange';

describe('weekRange', () => {
  describe('getWeekStart', () => {
    it('returns the Monday of the week for a mid-week (Friday) date', () => {
      expect(getWeekStart('2026-09-11')).toBe('2026-09-07');
    });

    it('returns the previous Monday when given a Sunday', () => {
      expect(getWeekStart('2026-09-13')).toBe('2026-09-07');
    });

    it('returns the same date when already given a Monday', () => {
      expect(getWeekStart('2026-09-07')).toBe('2026-09-07');
    });

    it('handles a week boundary that crosses a month', () => {
      expect(getWeekStart('2026-10-01')).toBe('2026-09-28');
    });
  });

  describe('getWeekDates', () => {
    it('returns all 7 dates of the week in order, Monday through Sunday', () => {
      expect(getWeekDates('2026-09-07')).toEqual([
        '2026-09-07',
        '2026-09-08',
        '2026-09-09',
        '2026-09-10',
        '2026-09-11',
        '2026-09-12',
        '2026-09-13',
      ]);
    });
  });

  describe('shiftWeek', () => {
    it('moves forward by whole weeks', () => {
      expect(shiftWeek('2026-09-07', 1)).toBe('2026-09-14');
      expect(shiftWeek('2026-09-07', 2)).toBe('2026-09-21');
    });

    it('moves backward by whole weeks, including across a month boundary', () => {
      expect(shiftWeek('2026-09-07', -1)).toBe('2026-08-31');
    });

    it('is a no-op for delta 0', () => {
      expect(shiftWeek('2026-09-07', 0)).toBe('2026-09-07');
    });
  });

  describe('formatDayLabel', () => {
    it('formats a date as "<weekday> <month> <day>"', () => {
      expect(formatDayLabel('2026-09-08')).toBe('Tue Sep 8');
    });
  });

  describe('formatWeekLabel', () => {
    it('formats a week as "Week of <Monday> - <Sunday>"', () => {
      expect(formatWeekLabel('2026-09-07')).toBe('Week of Mon Sep 7 - Sun Sep 13');
    });
  });
});
