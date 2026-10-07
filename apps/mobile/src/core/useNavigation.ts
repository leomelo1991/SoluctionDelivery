import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Delivery, NavigationRoute } from '@solution/contracts';
import { navigationTarget, shouldRefreshRoute } from './navigation';
import { type Position, type TrackingState, validPosition } from './location';
import { useSession } from './session';
export function useNavigation(
  delivery: Delivery | undefined,
  tracking: TrackingState,
  enabled: boolean,
) {
  const { client, user } = useSession();
  const target = navigationTarget(delivery);
  const key = target?.key;
  const position = tracking.status === 'ready' ? tracking.position : undefined;
  const [request, setRequest] = useState<{
    key: string;
    origin: Position;
    requestedAt: number;
  } | null>(null);
  useEffect(() => {
    if (!enabled || !key) {
      setRequest(null);
      return;
    }
    if (
      !enabled ||
      !key ||
      !position ||
      !validPosition({ coords: position, timestamp: position.timestamp })
    )
      return;
    setRequest((old) =>
      !old || old.key !== key || shouldRefreshRoute(old, position, Date.now())
        ? { key, origin: position, requestedAt: Date.now() }
        : old,
    );
  }, [enabled, key, position]);
  const matches = !!request && request.key === key;
  const route = useQuery({
    queryKey: [
      user?.tenantId,
      user?.id,
      'navigation',
      enabled ? key : null,
      enabled ? request?.requestedAt : null,
    ],
    queryFn: () =>
      client.request<NavigationRoute>(`/deliveries/${delivery!.id}/navigation`, 'POST', {
        latitude: request!.origin.latitude,
        longitude: request!.origin.longitude,
        timestamp: request!.origin.timestamp,
        version: delivery!.version,
      }),
    enabled: enabled && matches && !!position,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const data =
    enabled &&
    matches &&
    route.data?.deliveryId === delivery?.id &&
    route.data?.version === delivery?.version
      ? route.data
      : undefined;
  return {
    data,
    error: enabled && matches ? route.error : null,
    loading: enabled && !!key && !!position && (!matches || route.isFetching),
    retry: () => {
      if (key && position) setRequest({ key, origin: position, requestedAt: Date.now() });
    },
  };
}
