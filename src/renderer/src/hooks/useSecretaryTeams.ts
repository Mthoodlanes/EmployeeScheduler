import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DuesTeamInput } from '@shared/types/ipc';
import { api } from '../api/client';

const teamsKey = (leagueId: number) => ['secretaryTeams', leagueId] as const;

export function useSecretaryTeams(leagueId: number) {
  return useQuery({
    queryKey: teamsKey(leagueId),
    queryFn: () => api.secretary.teams.listForLeague({ leagueId }),
    enabled: Number.isInteger(leagueId),
  });
}

export function useCreateSecretaryTeam(leagueId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DuesTeamInput) => api.secretary.teams.create({ ...input, leagueId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamsKey(leagueId) }),
  });
}

export function useUpdateSecretaryTeam(leagueId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DuesTeamInput & { id: number }) => api.secretary.teams.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamsKey(leagueId) }),
  });
}

export function useRemoveSecretaryTeam(leagueId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.secretary.teams.remove({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamsKey(leagueId) }),
  });
}

export function useRemoveEmptySecretaryTeams(leagueId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.secretary.teams.removeEmpty({ leagueId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamsKey(leagueId) }),
  });
}
