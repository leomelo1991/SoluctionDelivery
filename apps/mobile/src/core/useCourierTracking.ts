import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import { createPositionPublisher } from '@solution/contracts';
import { observeLocation, type TrackingState } from './location';
import { useSession } from './session';
export function useCourierTracking(active: boolean, share: boolean) {
  const { client } = useSession();
  const [tracking, setTracking] = useState<TrackingState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [upload, setUpload] = useState<'waiting' | 'sent' | 'error'>('waiting');
  useEffect(() => {
    if (!active) return;
    setTracking({ status: 'loading' });
    setUpload('waiting');
    const publisher = createPositionPublisher(
      (sample) => client.request('/operations-map/location', 'POST', sample),
      setUpload,
    );
    const stop = observeLocation(
      {
        permission: Location.getForegroundPermissionsAsync,
        requestPermission: Location.requestForegroundPermissionsAsync,
        enabled: Location.hasServicesEnabledAsync,
        lastKnown: () =>
          Location.getLastKnownPositionAsync({ maxAge: 10000, requiredAccuracy: 100 }),
        watch: (callback, onError) =>
          Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 0 },
            callback,
            onError,
          ),
      },
      (state) => {
        setTracking(state);
        const p = state.position;
        if (share && state.status === 'ready' && p && p.accuracy !== null)
          publisher.push({
            latitude: p.latitude,
            longitude: p.longitude,
            accuracy: p.accuracy,
            observedAt: p.timestamp,
          });
      },
    );
    const timer = share ? setInterval(() => void publisher.flush(), 2000) : undefined;
    return () => {
      stop();
      publisher.stop();
      clearInterval(timer);
    };
  }, [active, share, client, attempt]);
  const retry = async () => {
    try {
      if (tracking.status === 'denied') {
        if (tracking.canAskAgain) await Location.requestForegroundPermissionsAsync();
        else {
          await Linking.openSettings();
          return;
        }
      }
      setAttempt((a) => a + 1);
    } catch {
      setTracking({ status: 'error' });
    }
  };
  return { tracking, retry, upload };
}
