import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as shiftTemplateService from '../../../../server/src/services/shiftTemplateService.js';
import type { RequestingActor } from '../../../../server/src/db/domain-types.js';

const managerActor: RequestingActor = { id: 999999, role: 'manager', isSecretaryTagged: false };
const employeeActor: RequestingActor = { id: 999998, role: 'employee', isSecretaryTagged: false };

beforeEach(async () => {
  await truncateAllTables();
});

describe('shiftTemplateService', () => {
  it('creates a shared (department-null) fixed-time template', async () => {
    const created = await shiftTemplateService.createShiftTemplate(managerActor, {
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

  it('refuses a non-manager from creating a shift template', async () => {
    await expect(
      shiftTemplateService.createShiftTemplate(employeeActor, {
        department: 'bar',
        name: 'Nope',
        startTime: '09:00',
        endTime: '17:00',
        startAnchor: 'fixed',
        endAnchor: 'fixed',
      }),
    ).rejects.toThrow(shiftTemplateService.UnauthorizedShiftTemplateActionError);
  });

  it('creates an anchored "2pm–Close" template, normalizing the end time to null', async () => {
    const created = await shiftTemplateService.createShiftTemplate(managerActor, {
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

  it('creates a fully anchored "Open–Close" template', async () => {
    const created = await shiftTemplateService.createShiftTemplate(managerActor, {
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

  it('rejects a fixed start anchor with no start time', async () => {
    await expect(
      shiftTemplateService.createShiftTemplate(managerActor, {
        department: 'bar',
        name: 'Bad Template',
        startTime: null,
        endTime: '18:00',
        startAnchor: 'fixed',
        endAnchor: 'fixed',
      }),
    ).rejects.toThrow();
  });

  it('rejects a fixed end anchor with no end time', async () => {
    await expect(
      shiftTemplateService.createShiftTemplate(managerActor, {
        department: 'bar',
        name: 'Bad Template',
        startTime: '10:00',
        endTime: null,
        startAnchor: 'fixed',
        endAnchor: 'fixed',
      }),
    ).rejects.toThrow();
  });

  it('updates a template, switching it from fixed to anchored', async () => {
    const created = await shiftTemplateService.createShiftTemplate(managerActor, {
      department: 'cafe',
      name: 'Cafe PM',
      startTime: '14:00',
      endTime: '18:00',
      startAnchor: 'fixed',
      endAnchor: 'fixed',
    });

    const updated = await shiftTemplateService.updateShiftTemplate(managerActor, {
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

  it('refuses a non-manager from updating or deactivating a template', async () => {
    const created = await shiftTemplateService.createShiftTemplate(managerActor, {
      department: 'cafe',
      name: 'Cafe PM',
      startTime: '14:00',
      endTime: '18:00',
      startAnchor: 'fixed',
      endAnchor: 'fixed',
    });

    await expect(
      shiftTemplateService.updateShiftTemplate(employeeActor, {
        id: created.id,
        name: 'Hacked',
        startTime: '14:00',
        endTime: '18:00',
        startAnchor: 'fixed',
        endAnchor: 'fixed',
        color: created.color,
        isActive: true,
      }),
    ).rejects.toThrow(shiftTemplateService.UnauthorizedShiftTemplateActionError);

    await expect(
      shiftTemplateService.deactivateShiftTemplate(employeeActor, created.id),
    ).rejects.toThrow(shiftTemplateService.UnauthorizedShiftTemplateActionError);
  });

  it('any logged-in actor may list templates', async () => {
    await shiftTemplateService.createShiftTemplate(managerActor, {
      department: 'cafe',
      name: 'Cafe PM',
      startTime: '14:00',
      endTime: '18:00',
      startAnchor: 'fixed',
      endAnchor: 'fixed',
    });

    expect(await shiftTemplateService.listShiftTemplates(employeeActor)).toHaveLength(1);
  });
});
