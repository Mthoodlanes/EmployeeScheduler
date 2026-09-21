import { useMemo } from 'react';
import { buildFlatEntries } from '@shared/logic/duesLedger';
import { useSecretaryLeague } from './useSecretaryLeagues';
import { useSecretaryTeams } from './useSecretaryTeams';
import { useSecretaryBowlersForLeague } from './useSecretaryBowlers';
import { useSecretaryWeeklyEntriesForLeague } from './useSecretaryWeeklyEntries';

/**
 * The common data shape both Bowler Summary and Season Summary need: the
 * league, its teams/bowlers, and every weekly entry flattened with each
 * entry's current due amount (see `duesLedger.ts`'s `buildFlatEntries` for
 * why that flattening has to happen here rather than being stored).
 */
export function useSecretaryDuesData(leagueId: number) {
  const leagueQuery = useSecretaryLeague(leagueId);
  const teamsQuery = useSecretaryTeams(leagueId);
  const bowlersQuery = useSecretaryBowlersForLeague(leagueId);
  const entriesQuery = useSecretaryWeeklyEntriesForLeague(leagueId);

  const { data: league } = leagueQuery;
  const { data: teams } = teamsQuery;
  const { data: bowlers } = bowlersQuery;
  const { data: weeklyEntries } = entriesQuery;

  const flatEntries = useMemo(() => {
    if (!league || !bowlers || !weeklyEntries) return [];
    return buildFlatEntries(league, bowlers, weeklyEntries);
  }, [league, bowlers, weeklyEntries]);

  return {
    league,
    teams: teams ?? [],
    bowlers: bowlers ?? [],
    flatEntries,
    isLoading:
      leagueQuery.isLoading ||
      teamsQuery.isLoading ||
      bowlersQuery.isLoading ||
      entriesQuery.isLoading,
    error: leagueQuery.error ?? teamsQuery.error ?? bowlersQuery.error ?? entriesQuery.error,
  };
}
