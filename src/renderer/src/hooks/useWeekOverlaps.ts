import { useQueries } from '@tanstack/react-query';
import { DEPARTMENTS } from '@shared/types/domain';
import { detectOverlaps } from '@shared/logic/overlapDetection';
import type { OverlapWarning } from '@shared/logic/overlapDetection';
import { api } from '../api/client';
import { useEmployees } from './useEmployees';
import { scheduleWeekKey } from './useSchedule';
import { useSpecialEvents } from './useSpecialEvents';
import { useStoreHours } from './useStoreHours';

export interface UseWeekOverlapsResult {
  overlaps: OverlapWarning[];
  isLoading: boolean;
}

/**
 * Aggregates scheduled shifts for `weekStart` across ALL THREE departments
 * (not just the currently active tab) and runs them through the pure
 * `overlapDetection` logic. Reuses the exact same query key each department
 * tab's own `useScheduleWeek` uses (`scheduleWeekKey`), so assigning/
 * overriding/removing a shift anywhere — which already invalidates that
 * department+week key — refreshes this aggregate automatically, with no
 * separate invalidation wiring needed. Also depends on `storeHours`/
 * `specialEvents` so an anchored ("2pm-Close") shift is resolved against
 * that date's actual effective hours before comparison — adding a special
 * event that changes closing time can create (or clear) a conflict live,
 * with no extra invalidation wiring since those queries already refresh the
 * schedule board's own re-render.
 */
export function useWeekOverlaps(weekStart: string): UseWeekOverlapsResult {
  const { data: employees, isLoading: employeesLoading } = useEmployees();
  const { data: storeHours } = useStoreHours();
  const { data: specialEvents } = useSpecialEvents();

  const weekQueries = useQueries({
    queries: DEPARTMENTS.map((department) => ({
      queryKey: scheduleWeekKey(department, weekStart),
      queryFn: () => api.scheduledShifts.listWeek({ department, weekStart }),
    })),
  });

  const isLoading = employeesLoading || weekQueries.some((query) => query.isLoading);
  const allShifts = weekQueries.flatMap((query) => query.data ?? []);

  // The full week's shifts across 3 departments is a tiny dataset, so this is
  // recomputed on every render rather than memoized — no need to fight
  // exhaustive-deps over `allShifts`'s fresh array identity each render.
  const overlaps = employees
    ? detectOverlaps(allShifts, employees, storeHours ?? [], specialEvents ?? [])
    : [];

  return { overlaps, isLoading };
}
