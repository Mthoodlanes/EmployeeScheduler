import type { Migration } from './types';
import { migration001Init } from './001_init';
import { migration002ScheduleExtras } from './002_schedule_extras';
import { migration003TimeOffExtras } from './003_time_off_extras';
import { migration004PreferenceNotes } from './004_preference_notes';
import { migration005ShiftTemplateAnchors } from './005_shift_template_anchors';
import { migration006ScheduledShiftAnchors } from './006_scheduled_shift_anchors';
import { migration007EmployeeUnavailability } from './007_employee_unavailability';
import { migration008AddMechanicDepartment } from './008_add_mechanic_department';
import { migration009EmployeeSortOrder } from './009_employee_sort_order';

/** Ordered list of all migrations. Append new ones; never reorder/remove. */
export const migrations: Migration[] = [
  migration001Init,
  migration002ScheduleExtras,
  migration003TimeOffExtras,
  migration004PreferenceNotes,
  migration005ShiftTemplateAnchors,
  migration006ScheduledShiftAnchors,
  migration007EmployeeUnavailability,
  migration008AddMechanicDepartment,
  migration009EmployeeSortOrder,
];
