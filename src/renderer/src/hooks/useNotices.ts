import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NoticesCreateRequest, NoticesUpdateRequest } from '@shared/types/ipc';
import { api } from '../api/client';

const NOTICES_KEY = ['notices'] as const;
const NOTICES_UNREAD_KEY = ['notices', 'unread-status'] as const;

/** Every notice (including expired) newest first — read by anyone logged in. */
export function useNotices() {
  return useQuery({
    queryKey: NOTICES_KEY,
    queryFn: () => api.notices.list(),
  });
}

/** Drives the nav badge and the one-time login toast. Refetches on window focus/remount like any other query, so a badge clears promptly once `markNoticesRead` invalidates it. */
export function useNoticesUnreadStatus() {
  return useQuery({
    queryKey: NOTICES_UNREAD_KEY,
    queryFn: () => api.notices.unreadStatus(),
  });
}

function invalidateNoticeQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: NOTICES_KEY });
  queryClient.invalidateQueries({ queryKey: NOTICES_UNREAD_KEY });
}

export function useCreateNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NoticesCreateRequest) => api.notices.create(input),
    onSuccess: () => invalidateNoticeQueries(queryClient),
  });
}

export function useUpdateNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NoticesUpdateRequest) => api.notices.update(input),
    onSuccess: () => invalidateNoticeQueries(queryClient),
  });
}

export function useRemoveNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.notices.remove({ id }),
    onSuccess: () => invalidateNoticeQueries(queryClient),
  });
}

/** Marks the board read up to now — call when the employee opens the Notice Board page. */
export function useMarkNoticesRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.notices.markRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTICES_UNREAD_KEY }),
  });
}
