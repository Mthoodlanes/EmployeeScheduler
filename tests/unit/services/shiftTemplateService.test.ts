import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as shiftTemplateService from '../../../src/main/services/shiftTemplateService';

beforeEach(() => {
  const db = initDb(':memory:');
  db.exec('DELETE FROM scheduled_shifts; DELETE FROM shift_templates;');
});

describe('shiftTemplateService', () => {
  it('creates a shared (department-null) fixed-time template', () => {
    const created = shiftTemplateService.createShiftTemplate({
      department: null,
      name: '9am–5pm',
      startTime: '09:00',
      endTime: '17:00',
      startAnchor: 'fixed',
      endAnchor: 'fixed',
    });

    expect(created.department).toBeNull();
    expect(created.startTime).toBe('09:00');
    expect(created.endTime).toBe('17:00');
  });

  it('creates an anchored "2pm–Close" template, normalizing the end time to null', () => {
    const created = shiftTemplateService.createShiftTemplate({
      department: null,
      name: '2pm–Close',
      startTime: '14:00',
      endTime: '23:59', // should be ignored/normalized away since endAnchor isn't fixed
      startAnchor: 'fixed',
      endAnchor: 'close',
    });

    expect(created.startTime).toBe('14:00');
    expect(created.endAnchor).toBe('close');
    expect(created.endTime).toBeNull();
  });

  it('creates a fully anchored "Open–Close" template', () => {
    const created = shiftTemplateService.createShiftTemplate({
      department: 'bar',
      name: 'Open–Close',
      startTime: null,
      endTime: null,
      startAnchor: 'open',
      endAnchor: 'close',
    });

    expect(created.startTime).toBeNull();
    expect(created.endTime).toBeNull();
    expect(created.startAnchor).toBe('open');
    expect(created.endAnchor).toBe('close');
  });

  it('rejects a fixed start anchor with no start time', () => {
    expect(() =>
      shiftTemplateService.createShiftTemplate({
        department: 'bar',
        name: 'Bad Template',
        startTime: null,
        endTime: '18:00',
        startAnchor: 'fixed',
        endAnchor: 'fixed',
      }),
    ).toThrow();
  });

  it('rejects a fixed end anchor with no end time', () => {
    expect(() =>
      shiftTemplateService.createShiftTemplate({
        department: 'bar',
        name: 'Bad Template',
        startTime: '10:00',
        endTime: null,
        startAnchor: 'fixed',
        endAnchor: 'fixed',
      }),
    ).toThrow();
  });

  it('updates a template, switching it from fixed to anchored', () => {
    const created = shiftTemplateService.createShiftTemplate({
      department: 'cafe',
      name: 'Cafe PM',
      startTime: '14:00',
      endTime: '18:00',
      startAnchor: 'fixed',
      endAnchor: 'fixed',
    });

    const updated = shiftTemplateService.updateShiftTemplate({
      id: created.id,
      name: 'Cafe PM',
      startTime: '14:00',
      endTime: null,
      startAnchor: 'fixed',
      endAnchor: 'close',
      color: created.color,
      isActive: true,
    });

    expect(updated.endAnchor).toBe('close');
    expect(updated.endTime).toBeNull();
  });
});
