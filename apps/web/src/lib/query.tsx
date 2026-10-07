import { createContext, useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@solution/contracts';
import { api, ApiError } from './api';
export const NoticeContext = createContext<(text: string, error?: boolean) => void>(
  () => undefined,
);
export const ActorContext = createContext<User | null>(null);
export const actorScope = (user: User) =>
  [user.tenantId, user.id, user.role, user.establishmentId ?? '', user.courierId ?? ''].join(':');
export function useData<T>(path: string, enabled = true) {
  const actor = useContext(ActorContext);
  return useQuery<T, ApiError>({
    queryKey: [actor ? actorScope(actor) : 'anonymous', path],
    queryFn: () => api<T>(path),
    enabled,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (count, error) => error.status === 0 && count < 1,
  });
}
export function useAction() {
  const client = useQueryClient();
  const notice = useContext(NoticeContext);
  return useMutation({
    mutationFn: ({
      path,
      method = 'POST',
      body,
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => api<unknown>(path, method, body),
    onSuccess: () => {
      notice('Alteração confirmada.');
    },
    onError: (e: Error) => notice(e.message, true),
    onSettled: () => {
      void client.invalidateQueries();
    },
  });
}
