import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ApiError } from './client';
import { useSession } from './session';
export function DataProvider({ children }: PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
            retry: (count, error) =>
              count < 1 && (!(error instanceof ApiError) || error.status >= 500),
            refetchInterval: false,
            refetchIntervalInBackground: false,
          },
          mutations: { retry: false, networkMode: 'always' },
        },
      }),
  );
  useEffect(() => {
    focusManager.setFocused(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    const unsubscribe = NetInfo.addEventListener((state) =>
      onlineManager.setOnline(state.isConnected !== false && state.isInternetReachable !== false),
    );
    return () => {
      listener.remove();
      unsubscribe();
      client.clear();
    };
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
export function useData<T>(path: string, enabled = true, interval: number | false = false) {
  const { client, user } = useSession();
  return useQuery({
    queryKey: [user?.tenantId, user?.id, path],
    queryFn: () => client.request<T>(path),
    enabled,
    refetchInterval: interval,
  });
}
export function useAction<T = unknown>() {
  const { client } = useSession();
  const query = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      method = 'POST',
      body,
    }: {
      path: string;
      method?: string;
      body?: object;
    }) => client.request<T>(path, method, body, path.startsWith('/deliveries/')),
    onSettled: () => {
      void query.invalidateQueries({ predicate: (entry) => entry.queryKey[2] !== 'navigation' });
    },
  });
}
