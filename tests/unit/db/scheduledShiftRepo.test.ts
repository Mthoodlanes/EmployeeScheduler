import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as employeeRepo from '../../../src/main/db/repositories/employeeRepo';
import * as scheduledShiftRepo from '../../../src/main/db/repositories/scheduledShiftRepo';
import * as shiftTemplateRepo from '../../../src/main/db/repositories/shiftTemplateRepo';

let employeeId: number;
let templateId: number;

beforeEach(() => {
  // Fresh in-memory database per test: initDb() memoizes a singleton keyed
  // by process, so reach past it here to guarantee isolation between tests.
  const db = initDb(':memory:');
  db.exec(
    'DELETE FROM scheduled_shifts; DELETE FROM shift_templates; DELETE FROM employee_departments; DELETE FROM employees;',
  );

  const employee = employeeRepo.create({
    name: 'Riley Front',
    username: `riley-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    departments: ['front_desk'],
  });
  employeeId = employee.id;

  const template = shiftTemplateRepo.create({
    department: 'front_desk',
    name: 'Front Desk AM',
    startTime: '08:00',
    endTime: '14:00',
  });
  templateId = template.id;
});

describe('scheduledShiftRepo', () => {
  it('creates a scheduled shift and reads it back', () => {
    const created = scheduledShiftRepo.create({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      startTime: '08:00',
      endTime: '14:00',
      templateId,
      isOverride: false,
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.isOverride).toBe(false);
    expect(created.templateId).toBe(templateId);
    expect(scheduledShiftRepo.getById(created.id)?.startTime).toBe('08:00');
  });

  it('lists shifts for a department within a date range only', () => {
    scheduledShiftRepo.create({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      startTime: '08:00',
      endTime: '14:00',
      templateId,
      isOverride: false,
    });
    scheduledShiftRepo.create({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-20',
      startTime: '08:00',
      endTime: '14:00',
      templateId,
      isOverride: false,
    });

    const weekShifts = scheduledShiftRepo.listByDepartmentAndDateRange(
      'front_desk',
      '2026-09-07',
      '2026-09-13',
    );
    expect(weekShifts).toHaveLength(1);
    expect(weekShifts[0].shiftDate).toBe('2026-09-08');
  });

  it('does not return shifts from a different department', () => {
    const barTemplate = shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:00',
    });
    scheduledShiftRepo.create({
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      startTime: '16:00',
      endTime: '23:00',
      templateId: barTemplate.id,
      isOverride: false,
    });

    const frontDeskShifts = scheduledShiftRepo.listByDepartmentAndDateRange(
      'front_desk',
      '2026-09-07',
      '2026-09-13',
    );
    expect(frontDeskShifts).toHaveLength(0);
  });

  it('marks a shift as an override and updates its time while keeping the template reference', () => {
    const created = scheduledShiftRepo.create({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      startTime: '08:00',
      endTime: '14:00',
      templateId,
      isOverride: false,
    });

    const overridden = scheduledShiftRepo.updateOverride({
      id: created.id,
      startTime: '09:00',
      endTime: '15:00',
    });

    expect(overridden.isOverride).toBe(true);
    expect(overridden.startTime).toBe('09:00');
    expect(overridden.endTime).toBe('15:00');
    expect(overridden.templateId).toBe(templateId);
  });

  it('removes a shift', () => {
    const created = scheduledShiftRepo.create({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      startTime: '08:00',
      endTime: '14:00',
      templateId,
      isOverride: false,
    });

    scheduledShiftRepo.remove(created.id);
    expect(scheduledShiftRepo.getById(created.id)).toBeUndefined();
  });

  it('defaults new shifts to a fixed/fixed anchor when none is supplied', () => {
    const created = scheduledShiftRepo.create({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      startTime: '08:00',
      endTime: '14:00',
      templateId,
      isOverride: false,
    });

    expect(created.startAnchor).toBe('fixed');
    expect(created.endAnchor).toBe('fixed');
  });

  it('creates an anchored shift with a null literal end time', () => {
    const created = scheduledShiftRepo.create({
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      startTime: '14:00',
      endTime: null,
      startAnchor: 'fixed',
      endAnchor: 'close',
      templateId: null,
      isOverride: false,
    });

    expect(created.endAnchor).toBe('close');
    expect(created.endTime).toBeNull();
    expect(created.templateId).toBeNull();
  });

  it('forces both anchors back to fixed when overriding, even if they were previously anchored', () => {
    const created = scheduledShiftRepo.create({
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      startTime: '14:00',
      endTime: null,
      startAnchor: 'fixed',
      endAnchor: 'close',
      templateId,
      isOverride: false,
    });

    const overridden = scheduledShiftRepo.updateOverride({
      id: created.id,
      startTime: '14:00',
      endTime: '22:00',
    });

    expect(overridden.startAnchor).toBe('fixed');
    expect(overridden.endAnchor).toBe('fixed');
    expect(overridden.endTime).toBe('22:00');
  });
});
