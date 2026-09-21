import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BowlerInput } from '@shared/types/ipc';
import { api } from '../api/client';

const bowlersForLeagueKey = (leagueId: number) => ['secretaryBowlers', 'league', leagueId] as const;

/** Every bowler across every team in the league — the Roster page filters this client-side per active team rather than issuing one request per team. */
export function useSecretaryBowlersForLeague(leagueId: number) {
  return useQuery({
    queryKey: bowlersForLeagueKey(leagueId),
    queryFn: () => api.secretary.bowlers.listForLeague({ leagueId }),
    enabled: Number.isInteger(leagueId),
  });
}

export function useCreateSecretaryBowler(leagueId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, input }: { teamId: number; input: BowlerInput }) =>
      api.secretary.bowlers.create({ ...input, teamId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bowlersForLeagueKey(leagueId) }),
  });
}

export function useUpdateSecretaryBowler(leagueId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BowlerInput & { id: number }) => api.secretary.bowlers.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bowlersForLeagueKey(leagueId) }),
  });
}

export function useRemoveSecretaryBowler(leagueId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.secretary.bowlers.remove({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bowlersForLeagueKey(leagueId) }),
  });
}
