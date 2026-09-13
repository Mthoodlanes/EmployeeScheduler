import { beforeEach, describe, expect, it } from 'vitest';
import { truncateAllTables } from '../dbTestSetup.js';
import * as shiftTemplateRepo from '../../../../server/src/db/repositories/shiftTemplateRepo.js';

beforeEach(async () => {
  await truncateAllTables();
});

describe('shiftTemplateRepo', () => {
  it('creates a template with a default color and is active by default', async () => {
    const created = await shiftTemplateRepo.create({
      department: 'front_desk',
      name: 'Front Desk AM',
      startTime: '08:00',
      endTime: '14:00',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.color).toBe('#D97706');
    expect(created.isActive).toBe(true);
  });

  it('creates a template with a custom color', async () => {
    const created = await shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:59',
      color: '#1D4ED8',
    });

    expect(created.color).toBe('#1D4ED8');
  });

  it('lists templates ordered by department then start time', async () => {
    await shiftTemplateRepo.create({
      department: 'cafe',
      name: 'Cafe PM',
      startTime: '13:00',
      endTime: '18:00',
    });
    await shiftTemplateRepo.create({
      department: 'cafe',
      name: 'Cafe AM',
      startTime: '07:00',
      endTime: '13:00',
    });

    const all = await shiftTemplateRepo.listAll();
    const cafeTemplates = all.filter((t) => t.department === 'cafe');
    expect(cafeTemplates.map((t) => t.name)).toEqual(['Cafe AM', 'Cafe PM']);
  });

  it('finds a template by department and name', async () => {
    await shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Open',
      startTime: '16:00',
      endTime: '23:59',
    });

    expect(await shiftTemplateRepo.findByDepartmentAndName('bar', 'Bar Open')).toBeDefined();
    expect(await shiftTemplateRepo.findByDepartmentAndName('bar', 'Nonexistent')).toBeUndefined();
  });

  it('updates a template', async () => {
    const created = await shiftTemplateRepo.create({
      department: 'front_desk',
      name: 'Front Desk AM',
      startTime: '08:00',
      endTime: '14:00',
    });

    const updated = await shiftTemplateRepo.update({
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

  it('deactivates a template', async () => {
    const created = await shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar Close',
      startTime: '18:00',
      endTime: '02:00',
    });

    const deactivated = await shiftTemplateRepo.deactivate(created.id);
    expect(deactivated.isActive).toBe(false);
  });

  it('creates a shared template with a NULL department', async () => {
    const created = await shiftTemplateRepo.create({
      department: null,
      name: '9am–5pm',
      startTime: '09:00',
      endTime: '17:00',
    });

    expect(created.department).toBeNull();
  });

  it('creates an anchored template with a null literal time for the anchored edge', async () => {
    const created = await shiftTemplateRepo.create({
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

  it('defaults new templates to a fixed/fixed anchor when none is supplied', async () => {
    const created = await shiftTemplateRepo.create({
      department: 'front_desk',
      name: 'Front Desk AM',
      startTime: '08:00',
      endTime: '14:00',
    });

    expect(created.startAnchor).toBe('fixed');
    expect(created.endAnchor).toBe('fixed');
  });

  it('finds a shared (NULL-department) template by name using a null-safe lookup', async () => {
    await shiftTemplateRepo.create({
      department: null,
      name: '2pm–Close',
      startTime: '14:00',
      endTime: null,
      endAnchor: 'close',
    });

    expect(await shiftTemplateRepo.findByDepartmentAndName(null, '2pm–Close')).toBeDefined();
    expect(await shiftTemplateRepo.findByDepartmentAndName('bar', '2pm–Close')).toBeUndefined();
  });

  it('updates a template to switch its end anchor and clear the literal end time', async () => {
    const created = await shiftTemplateRepo.create({
      department: 'bar',
      name: 'Bar PM',
      startTime: '16:00',
      endTime: '23:00',
    });

    const updated = await shiftTemplateRepo.update({
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
