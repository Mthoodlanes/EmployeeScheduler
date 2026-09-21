import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WeeklyEntry } from '@shared/types/domain';
import { api } from '../api/client';

export const weeklyEntriesForLeagueKey = (leagueId: number) =>
  ['secretaryWeeklyEntries', 'league', leagueId] as const;

/**
 * Every weekly entry for a league in one call. Used by the Roster page to
 * tell whether a bowler has dues history (disables Remove — see the
 * original app's `bowlerHasEntries` check) and by the Weekly Entries page
 * to feed `duesLedger.ts`'s pure functions.
 */
export function useSecretaryWeeklyEntriesForLeague(leagueId: number) {
  return useQuery({
    queryKey: weeklyEntriesForLeagueKey(leagueId),
    queryFn: () => api.secretary.weeklyEntries.listForLeague({ leagueId }),
    enabled: Number.isInteger(leagueId),
  });
}

interface OptimisticContext {
  previous: WeeklyEntry[] | undefined;
}

/**
 * Records a bowler's payment for one week (also how the Weekly Entries page
 * checks a bowler in as "playing," with amountPaid 0). Updates the cached
 * entry list optimistically — the "Playing?" checkbox's `checked` prop is
 * driven straight off this query, so without this the checkbox visibly
 * doesn't respond until the round trip finishes.
 */
export function useRecordSecretaryWeeklyEntry(leagueId: number) {
  const queryClient = useQueryClient();
  const queryKey = weeklyEntriesForLeagueKey(leagueId);
  return useMutation({
    mutationFn: (input: { bowlerId: number; week: number; amountPaid: number }) =>
      api.secretary.weeklyEntries.record(input),
    onMutate: async (input): Promise<OptimisticContext> => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WeeklyEntry[]>(queryKey);
      queryClient.setQueryData<WeeklyEntry[]>(queryKey, (current = []) => [
        ...current.filter(
          (entry) => !(entry.bowlerId === input.bowlerId && entry.week === input.week),
        ),
        { id: -1, bowlerId: input.bowlerId, week: input.week, amountPaid: input.amountPaid },
      ]);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

/** Unchecking a bowler as "playing" for a week removes their entry outright, matching the original app — also optimistic, for the same reason as recording an amount above. */
export function useRemoveSecretaryWeeklyEntry(leagueId: number) {
  const queryClient = useQueryClient();
  const queryKey = weeklyEntriesForLeagueKey(leagueId);
  return useMutation({
    mutationFn: (input: { bowlerId: number; week: number }) =>
      api.secretary.weeklyEntries.remove(input),
    onMutate: async (input): Promise<OptimisticContext> => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WeeklyEntry[]>(queryKey);
      queryClient.setQueryData<WeeklyEntry[]>(queryKey, (current = []) =>
        current.filter(
          (entry) => !(entry.bowlerId === input.bowlerId && entry.week === input.week),
        ),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
