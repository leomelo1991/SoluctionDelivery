export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}
export interface LocationSample {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
}
export function validPosition(sample: LocationSample, now = Date.now()): Position | null {
  const { latitude, longitude, accuracy } = sample.coords;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(sample.timestamp) ||
    sample.timestamp > now + 5000 ||
    now - sample.timestamp > 30000
  )
    return null;
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    timestamp: sample.timestamp,
  };
}
export type TrackingState = {
  status: 'loading' | 'ready' | 'denied' | 'disabled' | 'error';
  position?: Position;
  canAskAgain?: boolean;
};
export interface LocationPort {
  permission: () => Promise<{ granted: boolean; status: string; canAskAgain: boolean }>;
  requestPermission: () => Promise<{ granted: boolean; status: string; canAskAgain: boolean }>;
  enabled: () => Promise<boolean>;
  lastKnown?: () => Promise<LocationSample | null>;
  watch: (
    callback: (sample: LocationSample) => void,
    error: () => void,
  ) => Promise<{ remove: () => void }>;
}
export function observeLocation(port: LocationPort, onState: (state: TrackingState) => void) {
  let stopped = false;
  let subscription: { remove: () => void } | undefined;
  let lastTimestamp = 0;
  const timer = setTimeout(() => {
    if (!stopped && lastTimestamp === 0) onState({ status: 'error' });
  }, 20000);
  onState({ status: 'loading' });
  void (async () => {
    try {
      let permission = await port.permission();
      if (stopped) return;
      if (!permission.granted && permission.status === 'undetermined') {
        permission = await port.requestPermission();
        if (stopped) return;
      }
      if (!permission.granted) {
        clearTimeout(timer);
        onState({ status: 'denied', canAskAgain: permission.canAskAgain });
        return;
      }
      const enabled = await port.enabled();
      if (stopped) return;
      if (!enabled) {
        clearTimeout(timer);
        onState({ status: 'disabled' });
        return;
      }
      const receive = (sample: LocationSample) => {
        if (stopped) return;
        const position = validPosition(sample);
        if (!position || position.timestamp <= lastTimestamp) return;
        lastTimestamp = position.timestamp;
        clearTimeout(timer);
        onState({ status: 'ready', position });
      };
      // A recent device fix can locate the map before the first live GPS update.
      // Do not delay the watcher, and never replace a newer fix with cached data.
      if (port.lastKnown)
        void port
          .lastKnown()
          .then((sample) => {
            if (sample) receive(sample);
          })
          .catch(() => undefined);
      const listener = await port.watch(receive, () => {
        if (!stopped) {
          clearTimeout(timer);
          onState({ status: 'error' });
        }
      });
      if (stopped) listener.remove();
      else subscription = listener;
    } catch {
      clearTimeout(timer);
      if (!stopped) onState({ status: 'error' });
    }
  })();
  return () => {
    stopped = true;
    clearTimeout(timer);
    subscription?.remove();
  };
}
