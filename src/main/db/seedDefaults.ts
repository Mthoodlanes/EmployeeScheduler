import type Database from 'better-sqlite3';

/**
 * Ships REAL default operating data with every fresh install — distinct from
 * `scripts/seed.ts`'s dev-only fake demo employees/time-off/preferences.
 * Called once from `connection.ts#initDb` right after migrations run, on
 * every app start (dev, a packaged production build, and `npm run seed`
 * alike all go through `initDb()`). Idempotent: checks for existing rows
 * before inserting, so it's safe to call again against an already-seeded
 * database without creating duplicates.
 *
 * Uses raw SQL directly (like the migrations do) rather than the repository
 * layer so it only depends on the `Database` instance handed to it — no
 * dependency on `connection.ts`'s `getDb()` singleton, which keeps this
 * function trivially unit-testable against any fresh `:memory:` database.
 */

interface DefaultShiftTemplate {
  name: string;
  startTime: string | null;
  endTime: string | null;
  startAnchor: 'fixed' | 'open';
  endAnchor: 'fixed' | 'close';
}

/**
 * The 10 real Mt Hood Lanes shift templates, department = NULL (shared —
 * usable from any of the three department tabs) per the architecture plan.
 */
const DEFAULT_SHIFT_TEMPLATES: DefaultShiftTemplate[] = [
  {
    name: '9am–5pm',
    startTime: '09:00',
    endTime: '17:00',
    startAnchor: 'fixed',
    endAnchor: 'fixed',
  },
  {
    name: '1pm–11pm',
    startTime: '13:00',
    endTime: '23:00',
    startAnchor: 'fixed',
    endAnchor: 'fixed',
  },
  {
    name: '2pm–Close',
    startTime: '14:00',
    endTime: null,
    startAnchor: 'fixed',
    endAnchor: 'close',
  },
  {
    name: '6pm–10pm',
    startTime: '18:00',
    endTime: '22:00',
    startAnchor: 'fixed',
    endAnchor: 'fixed',
  },
  {
    name: '3:30pm–Close',
    startTime: '15:30',
    endTime: null,
    startAnchor: 'fixed',
    endAnchor: 'close',
  },
  {
    name: '8am–2pm',
    startTime: '08:00',
    endTime: '14:00',
    startAnchor: 'fixed',
    endAnchor: 'fixed',
  },
  {
    name: '2pm–6pm',
    startTime: '14:00',
    endTime: '18:00',
    startAnchor: 'fixed',
    endAnchor: 'fixed',
  },
  {
    name: '9am–4pm',
    startTime: '09:00',
    endTime: '16:00',
    startAnchor: 'fixed',
    endAnchor: 'fixed',
  },
  {
    name: '7am–5pm',
    startTime: '07:00',
    endTime: '17:00',
    startAnchor: 'fixed',
    endAnchor: 'fixed',
  },
  {
    name: '7am–4pm',
    startTime: '07:00',
    endTime: '16:00',
    startAnchor: 'fixed',
    endAnchor: 'fixed',
  },
];

interface DefaultStoreHours {
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday), matching the app-wide convention
  openTime: string;
  closeTime: string;
}

/**
 * The real Mt Hood Lanes weekly hours. Wednesday/Friday/Saturday close at
 * midnight, stored as "00:00" — per the app's midnight-crossing convention
 * (see `shiftMath.ts`/`hoursResolution.ts`), a close time less than or equal
 * to the open time is treated as falling on the following calendar day.
 */
const DEFAULT_STORE_HOURS: DefaultStoreHours[] = [
  { dayOfWeek: 0, openTime: '11:00', closeTime: '23:00' }, // Sunday
  { dayOfWeek: 1, openTime: '14:00', closeTime: '23:00' }, // Monday
  { dayOfWeek: 2, openTime: '14:00', closeTime: '23:00' }, // Tuesday
  { dayOfWeek: 3, openTime: '14:00', closeTime: '00:00' }, // Wednesday
  { dayOfWeek: 4, openTime: '14:00', closeTime: '23:00' }, // Thursday
  { dayOfWeek: 5, openTime: '14:00', closeTime: '00:00' }, // Friday
  { dayOfWeek: 6, openTime: '12:00', closeTime: '00:00' }, // Saturday
];

export function seedDefaults(db: Database.Database): void {
  const findSharedTemplateByName = db.prepare(
    'SELECT id FROM shift_templates WHERE department IS NULL AND name = ?',
  );
  const insertTemplate = db.prepare(
    `INSERT INTO shift_templates (department, name, start_time, end_time, start_anchor, end_anchor)
     VALUES (NULL, @name, @startTime, @endTime, @startAnchor, @endAnchor)`,
  );
  DEFAULT_SHIFT_TEMPLATES.forEach((template) => {
    if (findSharedTemplateByName.get(template.name)) {
      return;
    }
    insertTemplate.run(template);
  });

  const findStoreHoursByDay = db.prepare('SELECT id FROM store_hours WHERE day_of_week = ?');
  const insertStoreHours = db.prepare(
    `INSERT INTO store_hours (day_of_week, open_time, close_time, is_closed)
     VALUES (?, ?, ?, 0)`,
  );
  DEFAULT_STORE_HOURS.forEach((hours) => {
    if (findStoreHoursByDay.get(hours.dayOfWeek)) {
      return;
    }
    insertStoreHours.run(hours.dayOfWeek, hours.openTime, hours.closeTime);
  });
}
