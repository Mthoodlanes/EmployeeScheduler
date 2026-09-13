import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migration001Init } from '../../../src/main/db/migrations/001_init';
import { migration002ScheduleExtras } from '../../../src/main/db/migrations/002_schedule_extras';
import { migration003TimeOffExtras } from '../../../src/main/db/migrations/003_time_off_extras';
import { migration004PreferenceNotes } from '../../../src/main/db/migrations/004_preference_notes';
import { migration005ShiftTemplateAnchors } from '../../../src/main/db/migrations/005_shift_template_anchors';
import { migration006ScheduledShiftAnchors } from '../../../src/main/db/migrations/006_scheduled_shift_anchors';

interface ShiftTemplateRow {
  id: number;
  department: string | null;
  start_time: string | null;
  end_time: string | null;
  start_anchor: string;
  end_anchor: string;
}

interface ScheduledShiftRow {
  id: number;
  start_time: string | null;
  end_time: string | null;
  start_anchor: string;
  end_anchor: string;
}

describe('migrations 005/006 — shift template department nullable + anchors', () => {
  it('defaults pre-existing rows to a fixed anchor while preserving their data', () => {
    const db = new Database(':memory:');
    migration001Init.up(db);
    migration002ScheduleExtras.up(db);
    migration003TimeOffExtras.up(db);
    migration004PreferenceNotes.up(db);

    // Seed data using the OLD (pre-migration 005/006) schema shape, where
    // department/start_time/end_time were all NOT NULL and no anchor
    // columns existed yet.
    db.prepare(
      `INSERT INTO shift_templates (id, department, name, start_time, end_time, color)
       VALUES (1, 'bar', 'Bar Open', '16:00', '23:00', '#7C3AED')`,
    ).run();
    db.prepare(
      `INSERT INTO employees (id, name, username, password_hash, role)
       VALUES (1, 'Riley', 'riley', 'hash', 'employee')`,
    ).run();
    db.prepare(
      `INSERT INTO scheduled_shifts (id, employee_id, department, shift_date, start_time, end_time, template_id)
       VALUES (1, 1, 'bar', '2026-09-08', '16:00', '23:00', 1)`,
    ).run();

    migration005ShiftTemplateAnchors.up(db);
    migration006ScheduledShiftAnchors.up(db);

    const template = db
      .prepare('SELECT * FROM shift_templates WHERE id = 1')
      .get() as ShiftTemplateRow;
    expect(template.department).toBe('bar');
    expect(template.start_time).toBe('16:00');
    expect(template.end_time).toBe('23:00');
    expect(template.start_anchor).toBe('fixed');
    expect(template.end_anchor).toBe('fixed');

    const shift = db
      .prepare('SELECT * FROM scheduled_shifts WHERE id = 1')
      .get() as ScheduledShiftRow;
    expect(shift.start_time).toBe('16:00');
    expect(shift.end_time).toBe('23:00');
    expect(shift.start_anchor).toBe('fixed');
    expect(shift.end_anchor).toBe('fixed');

    db.close();
  });

  it('allows a NULL department and an anchored (nullable end time) template after migrating', () => {
    const db = new Database(':memory:');
    migration001Init.up(db);
    migration002ScheduleExtras.up(db);
    migration003TimeOffExtras.up(db);
    migration004PreferenceNotes.up(db);
    migration005ShiftTemplateAnchors.up(db);
    migration006ScheduledShiftAnchors.up(db);

    db.prepare(
      `INSERT INTO shift_templates (department, name, start_time, end_time, start_anchor, end_anchor)
       VALUES (NULL, '2pm–Close', '14:00', NULL, 'fixed', 'close')`,
    ).run();

    const shared = db
      .prepare("SELECT * FROM shift_templates WHERE name = '2pm–Close'")
      .get() as ShiftTemplateRow;
    expect(shared.department).toBeNull();
    expect(shared.start_time).toBe('14:00');
    expect(shared.end_time).toBeNull();
    expect(shared.end_anchor).toBe('close');

    db.close();
  });

  it('rejects an invalid anchor value via the CHECK constraint', () => {
    const db = new Database(':memory:');
    migration001Init.up(db);
    migration002ScheduleExtras.up(db);
    migration003TimeOffExtras.up(db);
    migration004PreferenceNotes.up(db);
    migration005ShiftTemplateAnchors.up(db);
    migration006ScheduledShiftAnchors.up(db);

    expect(() =>
      db
        .prepare(
          `INSERT INTO shift_templates (department, name, start_time, end_time, start_anchor, end_anchor)
           VALUES ('bar', 'Bad Anchor', '10:00', '18:00', 'close', 'fixed')`,
        )
        .run(),
    ).toThrow();

    db.close();
  });
});
