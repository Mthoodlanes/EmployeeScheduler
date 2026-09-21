import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

/** Records a bowler's payment for one week (also how the Weekly Entries page checks a bowler in as "playing," with amountPaid 0). */
export function useRecordSecretaryWeeklyEntry(leagueId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bowlerId: number; week: number; amountPaid: number }) =>
      api.secretary.weeklyEntries.record(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: weeklyEntriesForLeagueKey(leagueId) }),
  });
}

/** Unchecking a bowler as "playing" for a week removes their entry outright, matching the original app. */
export function useRemoveSecretaryWeeklyEntry(leagueId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bowlerId: number; week: number }) =>
      api.secretary.weeklyEntries.remove(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: weeklyEntriesForLeagueKey(leagueId) }),
  });
}
