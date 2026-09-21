import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SecretaryLeaguesCreateRequest, SecretaryLeaguesUpdateRequest } from '@shared/types/ipc';
import { api } from '../api/client';

const LEAGUES_KEY = ['secretaryLeagues'] as const;
const leagueKey = (id: number) => ['secretaryLeagues', id] as const;

export function useSecretaryLeagues() {
  return useQuery({
    queryKey: LEAGUES_KEY,
    queryFn: () => api.secretary.leagues.list(),
  });
}

export function useSecretaryLeague(id: number) {
  return useQuery({
    queryKey: leagueKey(id),
    queryFn: () => api.secretary.leagues.get(id),
  });
}

export function useCreateSecretaryLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SecretaryLeaguesCreateRequest) => api.secretary.leagues.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LEAGUES_KEY }),
  });
}

export function useUpdateSecretaryLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SecretaryLeaguesUpdateRequest) => api.secretary.leagues.update(input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: LEAGUES_KEY });
      queryClient.invalidateQueries({ queryKey: leagueKey(updated.id) });
    },
  });
}

export function useRemoveSecretaryLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.secretary.leagues.remove({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LEAGUES_KEY }),
  });
}
