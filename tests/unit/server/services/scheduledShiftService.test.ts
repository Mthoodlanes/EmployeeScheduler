import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as scheduledShiftRepo from '../../../../server/src/db/repositories/scheduledShiftRepo.js';
import * as shiftTemplateRepo from '../../../../server/src/db/repositories/shiftTemplateRepo.js';
import * as scheduledShiftService from '../../../../server/src/services/scheduledShiftService.js';
import { getTodayIso, getWeekStart, shiftWeek } from '../../../../server/src/logic/weekRange.js';
import type { RequestingActor } from '../../../../server/src/db/domain-types.js';

let employeeId: number;
// A real employee row rather than a fake id, since `publishWeek` persists
// `actor.id` as `schedule_publications.published_by_employee_id`, which is
// FK-constrained against `employees`.
let managerActor: RequestingActor;
const employeeActor: RequestingActor = { id: 999998, role: 'employee' };

beforeEach(async () => {
  await truncateAllTables();

  const manager = await employeeRepo.create({
    name: 'Jesse Manager',
    username: `jesse-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'manager',
    isSalaried: true,
    isSecretaryTagged: false,
    departments: [],
  });
  managerActor = { id: manager.id, role: 'manager' };

  const employee = await employeeRepo.create({
    name: 'Riley Front',
    username: `riley-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    isSecretaryTagged: false,
    departments: ['front_desk', 'bar'],
  });
  employeeId = employee.id;
});

describe('scheduledShiftService', () => {
  it('assigns a template to an employee, copying its start/end time', async () => {
    const template = await shiftTemplateRepo.create({
      department: 'front_desk',
      name: 'Front Desk AM',
      startTime: '08:00',
      endTime: '14:00',
    });

    const assigned = await scheduledShiftService.assignTemplate(managerActor, {
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

  it('refuses a non-manager from assigning a template', async () => {
    const template = await shiftTemplateRepo.create({
      department: 'front_desk',
      name: 'Front Desk AM',
      startTime: '08:00',
      endTime: '14:00',
    });

    await expect(
      scheduledShiftService.assignTemplate(employeeActor, {
        employeeId,
        department: 'front_desk',
        shiftDate: '2026-09-08',
        templateId: template.id,
      }),
    ).rejects.toThrow(scheduledShiftService.UnauthorizedScheduledShiftActionError);
  });

  it('throws when the template belongs to a different department', async () => {
    const template = await shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:00',
    });

    await expect(
      scheduledShiftService.assignTemplate(managerActor, {
        employeeId,
        department: 'front_desk',
        shiftDate: '2026-09-08',
        templateId: template.id,
      }),
    ).rejects.toThrow();
  });

  it('throws when the template does not exist', async () => {
    await expect(
      scheduledShiftService.assignTemplate(managerActor, {
        employeeId,
        department: 'front_desk',
        shiftDate: '2026-09-08',
        templateId: 999999,
      }),
    ).rejects.toThrow();
  });

  it('lists shifts for a department within a given week only', async () => {
    const template = await shiftTemplateRepo.create({
      department: 'front_desk',
      name: 'Front Desk AM',
      startTime: '08:00',
      endTime: '14:00',
    });
    await scheduledShiftService.assignTemplate(managerActor, {
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });
    await scheduledShiftService.assignTemplate(managerActor, {
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-20',
      templateId: template.id,
    });

    // A manager sees the full working draft regardless of publication state.
    const weekShifts = await scheduledShiftService.listWeek(
      managerActor,
      'front_desk',
      '2026-09-07',
    );
    expect(weekShifts).toHaveLength(1);
    expect(weekShifts[0].shiftDate).toBe('2026-09-08');
  });

  describe('publish gating', () => {
    it('hides an unpublished week from a non-manager but not from a manager', async () => {
      await scheduledShiftService.assignCustomShift(managerActor, {
        employeeId,
        department: 'front_desk',
        shiftDate: '2026-09-08',
        startAnchor: 'fixed',
        startTime: '08:00',
        endAnchor: 'fixed',
        endTime: '14:00',
      });

      expect(
        await scheduledShiftService.listWeek(employeeActor, 'front_desk', '2026-09-07'),
      ).toHaveLength(0);
      expect(
        await scheduledShiftService.listWeek(managerActor, 'front_desk', '2026-09-07'),
      ).toHaveLength(1);
    });

    it('reveals the week to a non-manager once a manager publishes it', async () => {
      await scheduledShiftService.assignCustomShift(managerActor, {
        employeeId,
        department: 'front_desk',
        shiftDate: '2026-09-08',
        startAnchor: 'fixed',
        startTime: '08:00',
        endAnchor: 'fixed',
        endTime: '14:00',
      });

      await scheduledShiftService.publishWeek(managerActor, 'front_desk', '2026-09-07');

      const shifts = await scheduledShiftService.listWeek(
        employeeActor,
        'front_desk',
        '2026-09-07',
      );
      expect(shifts).toHaveLength(1);
    });

    it('only publishes the requested department/week, leaving others hidden', async () => {
      await scheduledShiftService.assignCustomShift(managerActor, {
        employeeId,
        department: 'front_desk',
        shiftDate: '2026-09-08',
        startAnchor: 'fixed',
        startTime: '08:00',
        endAnchor: 'fixed',
        endTime: '14:00',
      });
      await scheduledShiftService.assignCustomShift(managerActor, {
        employeeId,
        department: 'bar',
        shiftDate: '2026-09-08',
        startAnchor: 'fixed',
        startTime: '16:00',
        endAnchor: 'fixed',
        endTime: '22:00',
      });

      await scheduledShiftService.publishWeek(managerActor, 'front_desk', '2026-09-07');

      expect(
        await scheduledShiftService.listWeek(employeeActor, 'front_desk', '2026-09-07'),
      ).toHaveLength(1);
      expect(
        await scheduledShiftService.listWeek(employeeActor, 'bar', '2026-09-07'),
      ).toHaveLength(0);
    });

    it('re-hides the week from a non-manager after a manager unpublishes it', async () => {
      await scheduledShiftService.assignCustomShift(managerActor, {
        employeeId,
        department: 'front_desk',
        shiftDate: '2026-09-08',
        startAnchor: 'fixed',
        startTime: '08:00',
        endAnchor: 'fixed',
        endTime: '14:00',
      });
      await scheduledShiftService.publishWeek(managerActor, 'front_desk', '2026-09-07');

      await scheduledShiftService.unpublishWeek(managerActor, 'front_desk', '2026-09-07');

      expect(
        await scheduledShiftService.listWeek(employeeActor, 'front_desk', '2026-09-07'),
      ).toHaveLength(0);
    });

    it('refuses a non-manager from publishing or unpublishing a week', async () => {
      await expect(
        scheduledShiftService.publishWeek(employeeActor, 'front_desk', '2026-09-07'),
      ).rejects.toThrow(scheduledShiftService.UnauthorizedScheduledShiftActionError);

      await expect(
        scheduledShiftService.unpublishWeek(employeeActor, 'front_desk', '2026-09-07'),
      ).rejects.toThrow(scheduledShiftService.UnauthorizedScheduledShiftActionError);
    });

    it('reports publication status via getWeekPublication', async () => {
      expect(
        await scheduledShiftService.getWeekPublication(employeeActor, 'front_desk', '2026-09-07'),
      ).toBeNull();

      await scheduledShiftService.publishWeek(managerActor, 'front_desk', '2026-09-07');

      const publication = await scheduledShiftService.getWeekPublication(
        employeeActor,
        'front_desk',
        '2026-09-07',
      );
      expect(publication?.department).toBe('front_desk');
      expect(publication?.weekStart).toBe('2026-09-07');
      expect(publication?.publishedByEmployeeId).toBe(managerActor.id);
    });
  });

  it('overrides a shift and removes a shift', async () => {
    const template = await shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:00',
    });
    const assigned = await scheduledShiftService.assignTemplate(managerActor, {
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });

    const overridden = await scheduledShiftService.overrideShift(managerActor, {
      id: assigned.id,
      startTime: '17:00',
      endTime: '23:59',
    });
    expect(overridden.isOverride).toBe(true);

    await scheduledShiftService.removeShift(managerActor, assigned.id);
    const remaining = await scheduledShiftService.listWeek(managerActor, 'bar', '2026-09-07');
    expect(remaining).toHaveLength(0);
  });

  it('refuses a non-manager from overriding or removing a shift', async () => {
    const template = await shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:00',
    });
    const assigned = await scheduledShiftService.assignTemplate(managerActor, {
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });

    await expect(
      scheduledShiftService.overrideShift(employeeActor, {
        id: assigned.id,
        startTime: '17:00',
        endTime: '23:59',
      }),
    ).rejects.toThrow(scheduledShiftService.UnauthorizedScheduledShiftActionError);

    await expect(
      scheduledShiftService.removeShift(employeeActor, assigned.id),
    ).rejects.toThrow(scheduledShiftService.UnauthorizedScheduledShiftActionError);
  });

  it('assigns a shared (department-null) template from any department', async () => {
    const shared = await shiftTemplateRepo.create({
      department: null,
      name: '2pm–Close',
      startTime: '14:00',
      endTime: null,
      startAnchor: 'fixed',
      endAnchor: 'close',
    });

    const assignedFrontDesk = await scheduledShiftService.assignTemplate(managerActor, {
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      templateId: shared.id,
    });
    expect(assignedFrontDesk.department).toBe('front_desk');
    expect(assignedFrontDesk.startTime).toBe('14:00');
    expect(assignedFrontDesk.endTime).toBeNull();
    expect(assignedFrontDesk.endAnchor).toBe('close');

    const assignedBar = await scheduledShiftService.assignTemplate(managerActor, {
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-09',
      templateId: shared.id,
    });
    expect(assignedBar.department).toBe('bar');
    expect(assignedBar.endAnchor).toBe('close');
  });

  it('still refuses a department-specific template from a different department', async () => {
    const template = await shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:00',
    });

    await expect(
      scheduledShiftService.assignTemplate(managerActor, {
        employeeId,
        department: 'front_desk',
        shiftDate: '2026-09-08',
        templateId: template.id,
      }),
    ).rejects.toThrow(scheduledShiftService.DepartmentMismatchError);
  });

  it('assigns a custom one-off time with no template, not flagged as an override', async () => {
    const custom = await scheduledShiftService.assignCustomShift(managerActor, {
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

  it('assigns a custom shift anchored to close, with no template and no literal end time', async () => {
    const custom = await scheduledShiftService.assignCustomShift(managerActor, {
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

  it('rejects a custom fixed start with no time supplied', async () => {
    await expect(
      scheduledShiftService.assignCustomShift(managerActor, {
        employeeId,
        department: 'bar',
        shiftDate: '2026-09-08',
        startAnchor: 'fixed',
        startTime: null,
        endAnchor: 'fixed',
        endTime: '18:00',
      }),
    ).rejects.toThrow();
  });

  it('forces both anchors back to fixed when a manager overrides an anchored shift', async () => {
    const template = await shiftTemplateRepo.create({
      department: 'bar',
      name: '2pm–Close (Bar)',
      startTime: '14:00',
      endTime: null,
      startAnchor: 'fixed',
      endAnchor: 'close',
    });
    const assigned = await scheduledShiftService.assignTemplate(managerActor, {
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });
    expect(assigned.endAnchor).toBe('close');

    const overridden = await scheduledShiftService.overrideShift(managerActor, {
      id: assigned.id,
      startTime: '14:00',
      endTime: '22:00',
    });
    expect(overridden.startAnchor).toBe('fixed');
    expect(overridden.endAnchor).toBe('fixed');
    expect(overridden.endTime).toBe('22:00');
  });

  it('leaves an already-scheduled shift fully intact after its originating template is later deactivated and edited', async () => {
    // `assignTemplate` copies the template's time/anchor fields onto the new
    // scheduled_shifts row at assignment time (see its doc comment) rather
    // than keeping a live reference — this proves that promise holds even
    // once the template itself is deactivated (and its own times changed).
    const template = await shiftTemplateRepo.create({
      department: 'bar',
      name: '2pm–Close (Bar)',
      startTime: '14:00',
      endTime: null,
      startAnchor: 'fixed',
      endAnchor: 'close',
    });
    const assigned = await scheduledShiftService.assignTemplate(managerActor, {
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });

    await shiftTemplateRepo.deactivate(template.id);
    await shiftTemplateRepo.update({
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
    const reloaded = await scheduledShiftRepo.getById(assigned.id);
    expect(reloaded?.startTime).toBe('14:00');
    expect(reloaded?.startAnchor).toBe('fixed');
    expect(reloaded?.endAnchor).toBe('close');
  });

  it('does not delete or alter an already-scheduled shift when the employee is later removed from that department', async () => {
    // employee_departments is pure roster-membership data with no foreign
    // key relationship to scheduled_shifts, so removing Bar from an
    // employee's departments after they've already been scheduled there must
    // not touch the historical shift row at all.
    const template = await shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:00',
    });
    const assigned = await scheduledShiftService.assignTemplate(managerActor, {
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      templateId: template.id,
    });

    // Riley was created with ['front_desk', 'bar'] departments in beforeEach.
    await employeeRepo.setDepartments(employeeId, ['front_desk']);

    const stillThere = await scheduledShiftRepo.getById(assigned.id);
    expect(stillThere).toBeDefined();
    expect(stillThere?.startTime).toBe('16:00');
    expect(stillThere?.endTime).toBe('23:00');

    const weekShifts = await scheduledShiftService.listWeek(managerActor, 'bar', '2026-09-07');
    expect(weekShifts).toHaveLength(1);
    expect(weekShifts[0].id).toBe(assigned.id);
  });

  describe('carryOverWeek', () => {
    it('copies every employee\'s shifts to the matching day next week, skipping days the target week already has a shift', async () => {
      const secondEmployee = await employeeRepo.create({
        name: 'Sam Bar',
        username: `sam-${Date.now()}-${Math.random()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: ['bar'],
      });

      // Source week: Mon 2026-08-31 - Sun 2026-09-06.
      await scheduledShiftRepo.create({
        employeeId,
        department: 'bar',
        shiftDate: '2026-09-01', // Tuesday
        startTime: '16:00',
        endTime: '23:00',
        templateId: null,
        isOverride: false,
      });
      await scheduledShiftRepo.create({
        employeeId: secondEmployee.id,
        department: 'bar',
        shiftDate: '2026-09-02', // Wednesday
        startTime: '10:00',
        endTime: '18:00',
        templateId: null,
        isOverride: false,
      });

      // Target week: Mon 2026-09-07 - Sun 2026-09-13. `employeeId` already has
      // a shift on the matching Tuesday, so that day must be left alone.
      const existingTargetShift = await scheduledShiftRepo.create({
        employeeId,
        department: 'bar',
        shiftDate: '2026-09-08', // Tuesday
        startTime: '12:00',
        endTime: '20:00',
        templateId: null,
        isOverride: false,
      });

      const created = await scheduledShiftService.carryOverWeek(managerActor, {
        department: 'bar',
        sourceWeekStart: '2026-08-31',
        targetWeekStart: '2026-09-07',
      });

      expect(created).toHaveLength(1);
      expect(created[0].employeeId).toBe(secondEmployee.id);
      expect(created[0].shiftDate).toBe('2026-09-09');
      expect(created[0].startTime).toBe('10:00');
      expect(created[0].endTime).toBe('18:00');

      const targetWeekShifts = await scheduledShiftService.listWeek(managerActor, 'bar', '2026-09-07');
      expect(targetWeekShifts).toHaveLength(2);
      const untouchedShift = targetWeekShifts.find((shift) => shift.id === existingTargetShift.id);
      expect(untouchedShift?.startTime).toBe('12:00');
    });

    it('carries over only the specified employee when employeeId is given', async () => {
      const secondEmployee = await employeeRepo.create({
        name: 'Sam Bar',
        username: `sam-${Date.now()}-${Math.random()}`,
        passwordHash: 'hash',
        role: 'employee',
        isSalaried: false,
        isSecretaryTagged: false,
        departments: ['bar'],
      });
      await scheduledShiftRepo.create({
        employeeId,
        department: 'bar',
        shiftDate: '2026-09-01',
        startTime: '16:00',
        endTime: '23:00',
        templateId: null,
        isOverride: false,
      });
      await scheduledShiftRepo.create({
        employeeId: secondEmployee.id,
        department: 'bar',
        shiftDate: '2026-09-01',
        startTime: '09:00',
        endTime: '15:00',
        templateId: null,
        isOverride: false,
      });

      const created = await scheduledShiftService.carryOverWeek(managerActor, {
        department: 'bar',
        sourceWeekStart: '2026-08-31',
        targetWeekStart: '2026-09-07',
        employeeId: secondEmployee.id,
      });

      expect(created).toHaveLength(1);
      expect(created[0].employeeId).toBe(secondEmployee.id);
    });

    it('refuses a non-manager from carrying over a week', async () => {
      await expect(
        scheduledShiftService.carryOverWeek(employeeActor, {
          department: 'bar',
          sourceWeekStart: '2026-08-31',
          targetWeekStart: '2026-09-07',
        }),
      ).rejects.toThrow(scheduledShiftService.UnauthorizedScheduledShiftActionError);
    });
  });

  describe('pruneShiftsOlderThanTwoWeeks', () => {
    it('deletes shifts dated before the two-week retention window, keeping everything newer', async () => {
      const currentWeekStart = getWeekStart(getTodayIso());
      const oldDate = shiftWeek(currentWeekStart, -3);
      const keptDate = shiftWeek(currentWeekStart, -1);

      const oldShift = await scheduledShiftRepo.create({
        employeeId,
        department: 'bar',
        shiftDate: oldDate,
        startTime: '16:00',
        endTime: '23:00',
        templateId: null,
        isOverride: false,
      });
      const keptShift = await scheduledShiftRepo.create({
        employeeId,
        department: 'bar',
        shiftDate: keptDate,
        startTime: '16:00',
        endTime: '23:00',
        templateId: null,
        isOverride: false,
      });

      await scheduledShiftService.pruneShiftsOlderThanTwoWeeks();

      expect(await scheduledShiftRepo.getById(oldShift.id)).toBeUndefined();
      expect(await scheduledShiftRepo.getById(keptShift.id)).toBeDefined();
    });
  });
});
