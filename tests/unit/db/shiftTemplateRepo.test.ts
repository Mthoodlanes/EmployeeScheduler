import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as shiftTemplateRepo from '../../../src/main/db/repositories/shiftTemplateRepo';

beforeEach(() => {
  // Fresh in-memory database per test: initDb() memoizes a singleton keyed
  // by process, so reach past it here to guarantee isolation between tests.
  const db = initDb(':memory:');
  db.exec('DELETE FROM scheduled_shifts; DELETE FROM shift_templates;');
});

describe('shiftTemplateRepo', () => {
  it('creates a template with a default color and is active by default', () => {
    const created = shiftTemplateRepo.create({
      department: 'front_desk',
      name: 'Front Desk AM',
      startTime: '08:00',
      endTime: '14:00',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.color).toBe('#D97706');
    expect(created.isActive).toBe(true);
  });

  it('creates a template with a custom color', () => {
    const created = shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:59',
      color: '#1D4ED8',
    });

    expect(created.color).toBe('#1D4ED8');
  });

  it('lists templates ordered by department then start time', () => {
    shiftTemplateRepo.create({
      department: 'cafe',
      name: 'Cafe PM',
      startTime: '13:00',
      endTime: '18:00',
    });
    shiftTemplateRepo.create({
      department: 'cafe',
      name: 'Cafe AM',
      startTime: '07:00',
      endTime: '13:00',
    });

    const cafeTemplates = shiftTemplateRepo.listAll().filter((t) => t.department === 'cafe');
    expect(cafeTemplates.map((t) => t.name)).toEqual(['Cafe AM', 'Cafe PM']);
  });

  it('finds a template by department and name', () => {
    shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:59',
    });

    expect(shiftTemplateRepo.findByDepartmentAndName('bar', 'Bar Open')).toBeDefined();
    expect(shiftTemplateRepo.findByDepartmentAndName('bar', 'Nonexistent')).toBeUndefined();
  });

  it('updates a template', () => {
    const created = shiftTemplateRepo.create({
      department: 'front_desk',
      name: 'Front Desk AM',
      startTime: '08:00',
      endTime: '14:00',
    });

    const updated = shiftTemplateRepo.update({
      id: created.id,
      name: 'Front Desk Early',
      startTime: '07:00',
      endTime: '13:00',
      startAnchor: 'fixed',
      endAnchor: 'fixed',
      color: '#059669',
      isActive: true,
    });

    expect(updated.name).toBe('Front Desk Early');
    expect(updated.startTime).toBe('07:00');
    expect(updated.endTime).toBe('13:00');
    expect(updated.color).toBe('#059669');
  });

  it('deactivates a template', () => {
    const created = shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Close',
      startTime: '18:00',
      endTime: '02:00',
    });

    const deactivated = shiftTemplateRepo.deactivate(created.id);
    expect(deactivated.isActive).toBe(false);
  });

  it('creates a shared template with a NULL department', () => {
    const created = shiftTemplateRepo.create({
      department: null,
      name: '9am–5pm',
      startTime: '09:00',
      endTime: '17:00',
    });

    expect(created.department).toBeNull();
  });

  it('creates an anchored template with a null literal time for the anchored edge', () => {
    const created = shiftTemplateRepo.create({
      department: null,
      name: '2pm–Close',
      startTime: '14:00',
      endTime: null,
      startAnchor: 'fixed',
      endAnchor: 'close',
    });

    expect(created.startAnchor).toBe('fixed');
    expect(created.endAnchor).toBe('close');
    expect(created.endTime).toBeNull();
  });

  it('defaults new templates to a fixed/fixed anchor when none is supplied', () => {
    const created = shiftTemplateRepo.create({
      department: 'front_desk',
      name: 'Front Desk AM',
      startTime: '08:00',
      endTime: '14:00',
    });

    expect(created.startAnchor).toBe('fixed');
    expect(created.endAnchor).toBe('fixed');
  });

  it('finds a shared (NULL-department) template by name using a null-safe lookup', () => {
    shiftTemplateRepo.create({
      department: null,
      name: '2pm–Close',
      startTime: '14:00',
      endTime: null,
      endAnchor: 'close',
    });

    expect(shiftTemplateRepo.findByDepartmentAndName(null, '2pm–Close')).toBeDefined();
    expect(shiftTemplateRepo.findByDepartmentAndName('bar', '2pm–Close')).toBeUndefined();
  });

  it('updates a template to switch its end anchor and clear the literal end time', () => {
    const created = shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar PM',
      startTime: '16:00',
      endTime: '23:00',
    });

    const updated = shiftTemplateRepo.update({
      id: created.id,
      name: created.name,
      startTime: created.startTime,
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
