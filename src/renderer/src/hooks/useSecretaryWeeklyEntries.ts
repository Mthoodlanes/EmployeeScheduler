import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export const weeklyEntriesForLeagueKey = (leagueId: number) =>
  ['secretaryWeeklyEntries', 'league', leagueId] as const;

/**
 * Every weekly entry for a league in one call. Used by the Roster page to
 * tell whether a bowler has dues history (disables Remove — see the
 * original app's `bowlerHasEntries` check); Milestone 7 (Weekly Entries
 * page) will add the record/remove mutations here too.
 */
export function useSecretaryWeeklyEntriesForLeague(leagueId: number) {
  return useQuery({
    queryKey: weeklyEntriesForLeagueKey(leagueId),
    queryFn: () => api.secretary.weeklyEntries.listForLeague({ leagueId }),
    enabled: Number.isInteger(leagueId),
  });
}
