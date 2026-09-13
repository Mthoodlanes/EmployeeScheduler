/**
 * Dev-only convenience seeder. Populates a demo manager and a few demo
 * employees across departments (including one salaried) so the app has
 * something to look at during manual testing. Distinct from the in-app
 * first-run setup flow — safe to run repeatedly, it skips usernames that
 * already exist.
 *
 * Usage: npm run seed
 */
import { initDb } from '../src/main/db/connection';
import { getDefaultDbPath } from '../src/main/db/userDataPath';
import * as employeeRepo from '../src/main/db/repositories/employeeRepo';
import * as preferenceRepo from '../src/main/db/repositories/preferenceRepo';
import * as shiftTemplateRepo from '../src/main/db/repositories/shiftTemplateRepo';
import * as specialEventRepo from '../src/main/db/repositories/specialEventRepo';
import * as storeHoursRepo from '../src/main/db/repositories/storeHoursRepo';
import * as timeOffRepo from '../src/main/db/repositories/timeOffRepo';
import { hashPassword } from '../src/main/services/authService';
import type { Department, Role } from '../src/shared/types/domain';

interface DemoEmployee {
  name: string;
  username: string;
  password: string;
  role: Role;
  isSalaried: boolean;
  departments: Department[];
}

const DEMO_EMPLOYEES: DemoEmployee[] = [
  {
    name: 'Dana Rivers',
    username: 'manager',
    password: 'password123',
    role: 'manager',
    isSalaried: false,
    departments: [],
  },
  {
    name: 'Alex Chen',
    username: 'alex',
    password: 'password123',
    role: 'employee',
    isSalaried: false,
    departments: ['front_desk'],
  },
  {
    name: 'Casey Nguyen',
    username: 'casey',
    password: 'password123',
    role: 'employee',
    isSalaried: false,
    departments: ['cafe', 'front_desk'],
  },
  {
    name: 'Jordan Blake',
    username: 'jordan',
    password: 'password123',
    role: 'employee',
    isSalaried: true,
    departments: ['bar'],
  },
];

interface DemoShiftTemplate {
  department: Department;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
}

const DEMO_SHIFT_TEMPLATES: DemoShiftTemplate[] = [
  {
    department: 'front_desk',
    name: 'Front Desk AM',
    startTime: '08:00',
    endTime: '14:00',
    color: '#D97706',
  },
  {
    department: 'front_desk',
    name: 'Front Desk PM',
    startTime: '14:00',
    endTime: '22:00',
    color: '#B45309',
  },
  {
    department: 'cafe',
    name: 'Cafe Morning',
    startTime: '07:00',
    endTime: '13:00',
    color: '#2563EB',
  },
  {
    department: 'cafe',
    name: 'Cafe Afternoon',
    startTime: '13:00',
    endTime: '19:00',
    color: '#1D4ED8',
  },
  {
    department: 'bar',
    name: 'Bar Open',
    startTime: '16:00',
    endTime: '23:59',
    color: '#7C3AED',
  },
  {
    department: 'bar',
    name: 'Bar Late',
    startTime: '18:00',
    endTime: '02:00',
    color: '#6D28D9',
  },
];

interface DemoPreference {
  username: string;
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday)
  preferredStartTime: string;
  preferredEndTime: string;
  note?: string;
}

// Alex prefers morning Front Desk shifts on Monday and Wednesday.
const DEMO_PREFERENCES: DemoPreference[] = [
  {
    username: 'alex',
    dayOfWeek: 1,
    preferredStartTime: '08:00',
    preferredEndTime: '12:00',
    note: 'Prefers mornings',
  },
  {
    username: 'alex',
    dayOfWeek: 3,
    preferredStartTime: '08:00',
    preferredEndTime: '12:00',
    note: 'Prefers mornings',
  },
];

interface DemoTimeOffRequest {
  username: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved';
}

function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

interface DemoStoreHours {
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday)
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

// Closed Mondays; otherwise 10-10, with Friday/Saturday open an hour later.
const DEMO_STORE_HOURS: DemoStoreHours[] = [
  { dayOfWeek: 0, openTime: '10:00', closeTime: '20:00', isClosed: false }, // Sunday
  { dayOfWeek: 1, openTime: null, closeTime: null, isClosed: true }, // Monday
  { dayOfWeek: 2, openTime: '10:00', closeTime: '22:00', isClosed: false }, // Tuesday
  { dayOfWeek: 3, openTime: '10:00', closeTime: '22:00', isClosed: false }, // Wednesday
  { dayOfWeek: 4, openTime: '10:00', closeTime: '22:00', isClosed: false }, // Thursday
  { dayOfWeek: 5, openTime: '10:00', closeTime: '23:00', isClosed: false }, // Friday
  { dayOfWeek: 6, openTime: '10:00', closeTime: '23:00', isClosed: false }, // Saturday
];

interface DemoSpecialEvent {
  eventDate: string;
  label: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

function demoSpecialEvents(): DemoSpecialEvent[] {
  const today = todayIso();
  return [
    {
      // A near-future date so the schedule board has something to show on first manual test.
      eventDate: addDays(today, 10),
      label: 'League Night — opens 2 hours early',
      isClosed: false,
      openTime: '08:00',
      closeTime: '22:00',
    },
  ];
}

function demoTimeOffRequests(): DemoTimeOffRequest[] {
  const today = todayIso();
  return [
    {
      username: 'alex',
      startDate: addDays(today, 5),
      endDate: addDays(today, 6),
      reason: 'Family trip',
      status: 'pending',
    },
    {
      username: 'casey',
      startDate: addDays(today, 1),
      endDate: addDays(today, 1),
      reason: 'Doctor appointment',
      status: 'approved',
    },
  ];
}

function seed(): void {
  const dbPath = getDefaultDbPath();
  initDb(dbPath);
  console.log(`Seeding database at ${dbPath}`);

  DEMO_EMPLOYEES.forEach((demo) => {
    const existing = employeeRepo.findByUsername(demo.username);
    if (existing) {
      console.log(`Skipping "${demo.username}" — already exists`);
      return;
    }
    employeeRepo.create({
      name: demo.name,
      username: demo.username,
      passwordHash: hashPassword(demo.password),
      role: demo.role,
      isSalaried: demo.isSalaried,
      departments: demo.departments,
    });
    console.log(`Created ${demo.role} "${demo.username}" (password: ${demo.password})`);
  });

  DEMO_SHIFT_TEMPLATES.forEach((demo) => {
    const existing = shiftTemplateRepo.findByDepartmentAndName(demo.department, demo.name);
    if (existing) {
      console.log(`Skipping shift template "${demo.name}" (${demo.department}) — already exists`);
      return;
    }
    shiftTemplateRepo.create(demo);
    console.log(`Created shift template "${demo.name}" (${demo.department})`);
  });

  DEMO_PREFERENCES.forEach((demo) => {
    const employee = employeeRepo.findByUsername(demo.username);
    if (!employee) {
      console.log(`Skipping preference for "${demo.username}" — employee not found`);
      return;
    }
    const existing = preferenceRepo
      .listByEmployee(employee.id)
      .find(
        (pref) =>
          pref.dayOfWeek === demo.dayOfWeek &&
          pref.preferredStartTime === demo.preferredStartTime &&
          pref.preferredEndTime === demo.preferredEndTime,
      );
    if (existing) {
      console.log(
        `Skipping preference for "${demo.username}" (day ${demo.dayOfWeek}) — already exists`,
      );
      return;
    }
    preferenceRepo.create({
      employeeId: employee.id,
      dayOfWeek: demo.dayOfWeek,
      preferredStartTime: demo.preferredStartTime,
      preferredEndTime: demo.preferredEndTime,
      note: demo.note ?? null,
    });
    console.log(`Created preference for "${demo.username}" (day ${demo.dayOfWeek})`);
  });

  DEMO_STORE_HOURS.forEach((demo) => {
    const existing = storeHoursRepo.getByDayOfWeek(demo.dayOfWeek);
    if (
      existing &&
      existing.openTime === demo.openTime &&
      existing.closeTime === demo.closeTime &&
      existing.isClosed === demo.isClosed
    ) {
      console.log(`Skipping store hours for day ${demo.dayOfWeek} — already set`);
      return;
    }
    storeHoursRepo.upsert(demo);
    console.log(
      `Set store hours for day ${demo.dayOfWeek}: ${demo.isClosed ? 'closed' : `${demo.openTime}-${demo.closeTime}`}`,
    );
  });

  demoSpecialEvents().forEach((demo) => {
    const existing = specialEventRepo.getByDate(demo.eventDate);
    if (existing) {
      console.log(`Skipping special event on ${demo.eventDate} — already exists`);
      return;
    }
    specialEventRepo.create(demo);
    console.log(`Created special event "${demo.label}" on ${demo.eventDate}`);
  });

  const manager = employeeRepo.findByUsername('manager');
  demoTimeOffRequests().forEach((demo) => {
    const employee = employeeRepo.findByUsername(demo.username);
    if (!employee) {
      console.log(`Skipping time-off request for "${demo.username}" — employee not found`);
      return;
    }
    const existing = timeOffRepo
      .listByEmployee(employee.id)
      .find((request) => request.startDate === demo.startDate && request.endDate === demo.endDate);
    if (existing) {
      console.log(
        `Skipping time-off request for "${demo.username}" (${demo.startDate} - ${demo.endDate}) — already exists`,
      );
      return;
    }
    const created = timeOffRepo.create({
      employeeId: employee.id,
      startDate: demo.startDate,
      endDate: demo.endDate,
      reason: demo.reason,
    });
    if (demo.status === 'approved' && manager) {
      timeOffRepo.updateStatus({ id: created.id, status: 'approved', decidedBy: manager.id });
    }
    console.log(
      `Created ${demo.status} time-off request for "${demo.username}" (${demo.startDate} - ${demo.endDate})`,
    );
  });

  console.log('Seed complete.');
}

seed();
