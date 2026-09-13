import { beforeEach, describe, expect, it } from 'vitest';
import { initDb } from '../../../src/main/db/connection';
import * as employeeRepo from '../../../src/main/db/repositories/employeeRepo';
import * as scheduledShiftRepo from '../../../src/main/db/repositories/scheduledShiftRepo';
import * as shiftTemplateRepo from '../../../src/main/db/repositories/shiftTemplateRepo';
import { resolveShiftTime } from '../../../src/shared/logic/hoursResolution';
import type { StoreHours } from '../../../src/shared/types/domain';
import * as scheduledShiftService from '../../../src/main/services/scheduledShiftService';

let employeeId: number;

beforeEach(() => {
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
    departments: ['front_desk', 'bar'],
  });
  employeeId = employee.id;
});

describe('scheduledShiftService', () => {
  it('assigns a template to an employee, copying its start/end time', () => {
    const template = shiftTemplateRepo.create({
      department: 'front_desk',
      name: 'Front Desk AM',
      startTime: '08:00',
      endTime: '14:00',
    });

    const assigned = scheduledShiftService.assignTemplate({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });

    expect(assigned.startTime).toBe('08:00');
    expect(assigned.endTime).toBe('14:00');
    expect(assigned.isOverride).toBe(false);
    expect(assigned.templateId).toBe(template.id);
  });

  it('throws when the template belongs to a different department', () => {
    const template = shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:00',
    });

    expect(() =>
      scheduledShiftService.assignTemplate({
        employeeId,
        department: 'front_desk',
        shiftDate: '2026-09-08',
        templateId: template.id,
      }),
    ).toThrow();
  });

  it('throws when the template does not exist', () => {
    expect(() =>
      scheduledShiftService.assignTemplate({
        employeeId,
        department: 'front_desk',
        shiftDate: '2026-09-08',
        templateId: 999999,
      }),
    ).toThrow();
  });

  it('lists shifts for a department within a given week only', () => {
    const template = shiftTemplateRepo.create({
      department: 'front_desk',
      name: 'Front Desk AM',
      startTime: '08:00',
      endTime: '14:00',
    });
    scheduledShiftService.assignTemplate({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });
    scheduledShiftService.assignTemplate({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-20',
      templateId: template.id,
    });

    const weekShifts = scheduledShiftService.listWeek('front_desk', '2026-09-07');
    expect(weekShifts).toHaveLength(1);
    expect(weekShifts[0].shiftDate).toBe('2026-09-08');
  });

  it('overrides a shift and removes a shift', () => {
    const template = shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:00',
    });
    const assigned = scheduledShiftService.assignTemplate({
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });

    const overridden = scheduledShiftService.overrideShift({
      id: assigned.id,
      startTime: '17:00',
      endTime: '23:59',
    });
    expect(overridden.isOverride).toBe(true);

    scheduledShiftService.removeShift(assigned.id);
    const remaining = scheduledShiftService.listWeek('bar', '2026-09-07');
    expect(remaining).toHaveLength(0);
  });

  it('assigns a shared (department-null) template from any department', () => {
    const shared = shiftTemplateRepo.create({
      department: null,
      name: '2pm–Close',
      startTime: '14:00',
      endTime: null,
      startAnchor: 'fixed',
      endAnchor: 'close',
    });

    const assignedFrontDesk = scheduledShiftService.assignTemplate({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      templateId: shared.id,
    });
    expect(assignedFrontDesk.department).toBe('front_desk');
    expect(assignedFrontDesk.startTime).toBe('14:00');
    expect(assignedFrontDesk.endTime).toBeNull();
    expect(assignedFrontDesk.endAnchor).toBe('close');

    const assignedBar = scheduledShiftService.assignTemplate({
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-09',
      templateId: shared.id,
    });
    expect(assignedBar.department).toBe('bar');
    expect(assignedBar.endAnchor).toBe('close');
  });

  it('still refuses a department-specific template from a different department', () => {
    const template = shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:00',
    });

    expect(() =>
      scheduledShiftService.assignTemplate({
        employeeId,
        department: 'front_desk',
        shiftDate: '2026-09-08',
        templateId: template.id,
      }),
    ).toThrow(scheduledShiftService.DepartmentMismatchError);
  });

  it('assigns a custom one-off time with no template, not flagged as an override', () => {
    const custom = scheduledShiftService.assignCustomShift({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      startAnchor: 'fixed',
      startTime: '10:00',
      endAnchor: 'fixed',
      endTime: '15:00',
    });

    expect(custom.templateId).toBeNull();
    expect(custom.isOverride).toBe(false);
    expect(custom.startTime).toBe('10:00');
    expect(custom.endTime).toBe('15:00');
  });

  it('assigns a custom shift anchored to close, with no template and no literal end time', () => {
    const custom = scheduledShiftService.assignCustomShift({
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      startAnchor: 'fixed',
      startTime: '18:00',
      endAnchor: 'close',
      endTime: null,
    });

    expect(custom.templateId).toBeNull();
    expect(custom.isOverride).toBe(false);
    expect(custom.endAnchor).toBe('close');
    expect(custom.endTime).toBeNull();
  });

  it('rejects a custom fixed start with no time supplied', () => {
    expect(() =>
      scheduledShiftService.assignCustomShift({
        employeeId,
        department: 'bar',
        shiftDate: '2026-09-08',
        startAnchor: 'fixed',
        startTime: null,
        endAnchor: 'fixed',
        endTime: '18:00',
      }),
    ).toThrow();
  });

  it('forces both anchors back to fixed when a manager overrides an anchored shift', () => {
    const template = shiftTemplateRepo.create({
      department: 'bar',
      name: '2pm–Close (Bar)',
      startTime: '14:00',
      endTime: null,
      startAnchor: 'fixed',
      endAnchor: 'close',
    });
    const assigned = scheduledShiftService.assignTemplate({
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });
    expect(assigned.endAnchor).toBe('close');

    const overridden = scheduledShiftService.overrideShift({
      id: assigned.id,
      startTime: '14:00',
      endTime: '22:00',
    });
    expect(overridden.startAnchor).toBe('fixed');
    expect(overridden.endAnchor).toBe('fixed');
    expect(overridden.endTime).toBe('22:00');
  });

  it('leaves an already-scheduled shift fully intact and correctly resolvable after its originating template is later deactivated and edited', () => {
    // `assignTemplate` copies the template's time/anchor fields onto the new
    // scheduled_shifts row at assignment time (see its doc comment) rather
    // than keeping a live reference — this proves that promise holds even
    // once the template itself is deactivated (and its own times changed),
    // exactly the "shift template deactivated after being used in past
    // schedules" scenario called out for Milestone 12 hardening.
    const template = shiftTemplateRepo.create({
      department: 'bar',
      name: '2pm–Close (Bar)',
      startTime: '14:00',
      endTime: null,
      startAnchor: 'fixed',
      endAnchor: 'close',
    });
    const assigned = scheduledShiftService.assignTemplate({
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });

    // Deactivate the template, then even change its own start time — a
    // manager might do both while cleaning up an old template.
    shiftTemplateRepo.deactivate(template.id);
    shiftTemplateRepo.update({
      id: template.id,
      name: template.name,
      startTime: '16:00',
      endTime: null,
      startAnchor: 'fixed',
      endAnchor: 'close',
      color: template.color,
      isActive: false,
    });

    // The historical scheduled shift is untouched: still 14:00-Close, not
    // the template's new 16:00-Close.
    const reloaded = scheduledShiftRepo.getById(assigned.id);
    expect(reloaded?.startTime).toBe('14:00');
    expect(reloaded?.startAnchor).toBe('fixed');
    expect(reloaded?.endAnchor).toBe('close');

    // And it still resolves correctly against store hours using its OWN
    // (copied) anchor/time fields — resolution never re-reads the template.
    const storeHours: StoreHours[] = [
      { id: 1, dayOfWeek: 2, openTime: '10:00', closeTime: '22:00', isClosed: false },
    ];
    const resolvedStart = resolveShiftTime(
      reloaded!.startAnchor,
      reloaded!.startTime,
      reloaded!.shiftDate,
      storeHours,
      [],
    );
    const resolvedEnd = resolveShiftTime(
      reloaded!.endAnchor,
      reloaded!.endTime,
      reloaded!.shiftDate,
      storeHours,
      [],
    );
    expect(resolvedStart).toBe('14:00');
    expect(resolvedEnd).toBe('22:00');
  });

  it('does not delete or alter an already-scheduled shift when the employee is later removed from that department', () => {
    // employee_departments is pure roster-membership data with no foreign
    // key relationship to scheduled_shifts, so removing Bar from an
    // employee's departments after they've already been scheduled there must
    // not touch the historical shift row at all (it simply stops appearing
    // as a roster row on that department's tab going forward — a UI-level
    // display concern, not a data-integrity one).
    const template = shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:00',
    });
    const assigned = scheduledShiftService.assignTemplate({
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });

    // Riley was created with ['front_desk', 'bar'] departments in beforeEach.
    employeeRepo.setDepartments(employeeId, ['front_desk']);

    const stillThere = scheduledShiftRepo.getById(assigned.id);
    expect(stillThere).toBeDefined();
    expect(stillThere?.startTime).toBe('16:00');
    expect(stillThere?.endTime).toBe('23:00');

    const weekShifts = scheduledShiftService.listWeek('bar', '2026-09-07');
    expect(weekShifts).toHaveLength(1);
    expect(weekShifts[0].id).toBe(assigned.id);
  });
});
