import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as employeeRepo from '../../../../server/src/db/repositories/employeeRepo.js';
import * as scheduledShiftRepo from '../../../../server/src/db/repositories/scheduledShiftRepo.js';
import * as shiftTemplateRepo from '../../../../server/src/db/repositories/shiftTemplateRepo.js';

let employeeId: number;
let templateId: number;

beforeEach(async () => {
  await truncateAllTables();

  const employee = await employeeRepo.create({
    name: 'Riley Front',
    username: `riley-${Date.now()}-${Math.random()}`,
    passwordHash: 'hash',
    role: 'employee',
    isSalaried: false,
    departments: ['front_desk'],
  });
  employeeId = employee.id;

  const template = await shiftTemplateRepo.create({
    department: 'front_desk',
    name: 'Front Desk AM',
    startTime: '08:00',
    endTime: '14:00',
  });
  templateId = template.id;
});

describe('scheduledShiftRepo', () => {
  it('creates a scheduled shift and reads it back', async () => {
    const created = await scheduledShiftRepo.create({
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
    expect((await scheduledShiftRepo.getById(created.id))?.startTime).toBe('08:00');
  });

  it('lists shifts for a department within a date range only', async () => {
    await scheduledShiftRepo.create({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      startTime: '08:00',
      endTime: '14:00',
      templateId,
      isOverride: false,
    });
    await scheduledShiftRepo.create({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-20',
      startTime: '08:00',
      endTime: '14:00',
      templateId,
      isOverride: false,
    });

    const weekShifts = await scheduledShiftRepo.listByDepartmentAndDateRange(
      'front_desk',
      '2026-09-07',
      '2026-09-13',
    );
    expect(weekShifts).toHaveLength(1);
    expect(weekShifts[0].shiftDate).toBe('2026-09-08');
  });

  it('does not return shifts from a different department', async () => {
    const barTemplate = await shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:00',
    });
    await scheduledShiftRepo.create({
      employeeId,
      department: 'bar',
      shiftDate: '2026-09-08',
      startTime: '16:00',
      endTime: '23:00',
      templateId: barTemplate.id,
      isOverride: false,
    });

    const frontDeskShifts = await scheduledShiftRepo.listByDepartmentAndDateRange(
      'front_desk',
      '2026-09-07',
      '2026-09-13',
    );
    expect(frontDeskShifts).toHaveLength(0);
  });

  it('marks a shift as an override and updates its time while keeping the template reference', async () => {
    const created = await scheduledShiftRepo.create({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      startTime: '08:00',
      endTime: '14:00',
      templateId,
      isOverride: false,
    });

    const overridden = await scheduledShiftRepo.updateOverride({
      id: created.id,
      startTime: '09:00',
      endTime: '15:00',
    });

    expect(overridden.isOverride).toBe(true);
    expect(overridden.startTime).toBe('09:00');
    expect(overridden.endTime).toBe('15:00');
    expect(overridden.templateId).toBe(templateId);
  });

  it('removes a shift', async () => {
    const created = await scheduledShiftRepo.create({
      employeeId,
      department: 'front_desk',
      shiftDate: '2026-09-08',
      startTime: '08:00',
      endTime: '14:00',
      templateId,
      isOverride: false,
    });

    await scheduledShiftRepo.remove(created.id);
    expect(await scheduledShiftRepo.getById(created.id)).toBeUndefined();
  });

  it('defaults new shifts to a fixed/fixed anchor when none is supplied', async () => {
    const created = await scheduledShiftRepo.create({
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

  it('creates an anchored shift with a null literal end time', async () => {
    const created = await scheduledShiftRepo.create({
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

  it('forces both anchors back to fixed when overriding, even if they were previously anchored', async () => {
    const created = await scheduledShiftRepo.create({
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

    const overridden = await scheduledShiftRepo.updateOverride({
      id: created.id,
      startTime: '14:00',
      endTime: '22:00',
    });

    expect(overridden.startAnchor).toBe('fixed');
    expect(overridden.endAnchor).toBe('fixed');
    expect(overridden.endTime).toBe('22:00');
  });
});
