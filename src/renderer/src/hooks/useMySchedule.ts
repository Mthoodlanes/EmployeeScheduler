import { useQueries } from '@tanstack/react-query';
import { DEPARTMENTS } from '@shared/types/domain';
import type { ScheduledShift } from '@shared/types/domain';
import { api } from '../api/client';
import { scheduleWeekKey } from './useSchedule';

export interface UseAllDepartmentsScheduleWeekResult {
  shifts: ScheduledShift[];
  isLoading: boolean;
}

/**
 * Aggregates scheduled shifts for `weekStart` across ALL THREE departments —
 * an employee may belong to more than one of Front Desk/Cafe/Bar, and this
 * powers the read-only "My Schedule" page, which needs to show a single
 * employee's shifts regardless of which department(s) they fall under.
 * Mirrors `useWeekOverlaps.ts`'s cross-department aggregation exactly,
 * reusing the same query key each department tab's own `useScheduleWeek`
 * uses (`scheduleWeekKey`) — so a manager assigning/editing/removing a shift
 * anywhere (which already invalidates that department+week key) keeps this
 * view fresh too, with no separate invalidation wiring needed. Callers
 * filter the aggregate down to one employee (see `buildMyScheduleDays`).
 */
export function useAllDepartmentsScheduleWeek(
  weekStart: string,
): UseAllDepartmentsScheduleWeekResult {
  const weekQueries = useQueries({
    queries: DEPARTMENTS.map((department) => ({
      queryKey: scheduleWeekKey(department, weekStart),
      queryFn: () => api.scheduledShifts.listWeek({ department, weekStart }),
    })),
  });

  return {
    shifts: weekQueries.flatMap((query) => query.data ?? []),
    isLoading: weekQueries.some((query) => query.isLoading),
  };
}
