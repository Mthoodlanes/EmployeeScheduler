import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

const BACKUPS_KEY = ['secretaryBackups'] as const;

export function useSecretaryBackups() {
  return useQuery({
    queryKey: BACKUPS_KEY,
    queryFn: () => api.secretary.backups.list(),
  });
}

export function useCreateSecretaryBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label: string | null) => api.secretary.backups.create({ label }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BACKUPS_KEY }),
  });
}

/**
 * A restore can change every league/team/bowler/entry in the database at
 * once, not just the one league a page happens to be looking at — every
 * other Secretary Apps query (leagues/teams/bowlers/weeklyEntries, each
 * under its own top-level key) needs to be treated as stale, not just this
 * hook's own `secretaryBackups` list.
 */
export function useRestoreSecretaryBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; confirmationText: string }) =>
      api.secretary.backups.restore(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('secretary'),
      });
    },
  });
}
