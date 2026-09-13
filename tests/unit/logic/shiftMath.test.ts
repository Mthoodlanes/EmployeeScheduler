import { describe, expect, it } from 'vitest';
import {
  shiftDurationMinutes,
  timeRangesOverlap,
  timeToMinutes,
} from '../../../src/shared/logic/shiftMath';

describe('timeToMinutes', () => {
  it('converts HH:mm to minutes since midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

describe('shiftDurationMinutes', () => {
  it('computes a normal same-day duration', () => {
    expect(shiftDurationMinutes('09:00', '17:00')).toBe(8 * 60);
    expect(shiftDurationMinutes('14:00', '18:00')).toBe(4 * 60);
  });

  it('treats an end time less than the start time as crossing midnight', () => {
    // 18:00 - 02:00 -> 8 hours (18:00 to 24:00, plus 02:00).
    expect(shiftDurationMinutes('18:00', '02:00')).toBe(8 * 60);
  });

  it('treats an end time equal to the start time as a full 24-hour shift, not zero', () => {
    expect(shiftDurationMinutes('14:00', '14:00')).toBe(24 * 60);
  });

  it('computes the real Mt Hood Lanes midnight-crossing store hours correctly', () => {
    // Wednesday: 14:00-00:00 -> 10 hours.
    expect(shiftDurationMinutes('14:00', '00:00')).toBe(10 * 60);
    // Saturday: 12:00-00:00 -> 12 hours.
    expect(shiftDurationMinutes('12:00', '00:00')).toBe(12 * 60);
  });

  it('computes a short post-midnight duration correctly (e.g. 23:00 to 00:30)', () => {
    expect(shiftDurationMinutes('23:00', '00:30')).toBe(90);
  });
});

describe('timeRangesOverlap', () => {
  it('detects a normal same-day overlap', () => {
    expect(timeRangesOverlap('09:00', '14:00', '13:00', '18:00')).toBe(true);
  });

  it('does not flag ranges that only touch at an endpoint', () => {
    expect(timeRangesOverlap('09:00', '14:00', '14:00', '18:00')).toBe(false);
  });

  it('does not flag genuinely separate same-day ranges', () => {
    expect(timeRangesOverlap('09:00', '11:00', '15:00', '18:00')).toBe(false);
  });

  it('correctly flags two overlapping shifts that both cross midnight (same shift_date)', () => {
    // 22:00-02:00 and 23:00-03:00, both dated to the same day and both
    // extending into the next calendar day, overlap from 23:00 to 02:00.
    expect(timeRangesOverlap('22:00', '02:00', '23:00', '03:00')).toBe(true);
  });

  it('does not falsely flag a midnight-crossing closing shift against an early-morning shift the same shift_date', () => {
    // A closing shift 20:00-00:00 (that day's evening into midnight) does not
    // overlap that SAME shift_date's 06:00-10:00 opening-prep shift — the
    // opening shift happens hours earlier that morning, well before 20:00.
    expect(timeRangesOverlap('20:00', '00:00', '06:00', '10:00')).toBe(false);
  });
});
