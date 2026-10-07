import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
import * as Location from 'expo-location';
import type { Delivery } from '@solution/contracts';
import { navigationTarget } from '../core/navigation';
import { useNavigation } from '../core/useNavigation';
import { observeLocation, type TrackingState } from '../core/location';
import { Button, Copy, useTheme } from './ui';
const initialRegion = {
  latitude: -23.55052,
  longitude: -46.633308,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};
export const CourierMap = memo(function CourierMap({
  active,
  delivery,
  bottomInset = 0,
}: {
  active: boolean;
  delivery?: Delivery;
  bottomInset?: number;
}) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const map = useRef<MapView>(null);
  const [tracking, setTracking] = useState<TrackingState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [follow, setFollow] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [mapTimeout, setMapTimeout] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  useEffect(() => {
    if (!active || loaded) return;
    const timer = setTimeout(() => setMapTimeout(true), 20000);
    return () => clearTimeout(timer);
  }, [active, loaded, mapAttempt]);
  useEffect(() => {
    if (!active) return;
    return observeLocation(
      {
        permission: Location.getForegroundPermissionsAsync,
        requestPermission: Location.requestForegroundPermissionsAsync,
        enabled: Location.hasServicesEnabledAsync,
        lastKnown: () =>
          Location.getLastKnownPositionAsync({ maxAge: 30000, requiredAccuracy: 100 }),
        watch: (callback, onError) =>
          Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
            callback,
            onError,
          ),
      },
      setTracking,
    );
  }, [active, attempt]);
  const target = navigationTarget(delivery);
  const route = useNavigation(delivery, tracking, active && Platform.OS === 'android');
  const coordinates = route.data?.coordinates;
  useEffect(() => {
    setFollow(true);
  }, [delivery?.id, target?.leg]);
  useEffect(() => {
    if (active && ready && coordinates && follow)
      map.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 130, left: 40, right: 40, bottom: 80 },
        animated: true,
      });
  }, [active, ready, coordinates, follow, bottomInset]);
  const latitude = tracking.position?.latitude;
  const longitude = tracking.position?.longitude;
  const position = useMemo(
    () => (latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined),
    [latitude, longitude],
  );
  useEffect(() => {
    if (ready && follow && position && !coordinates)
      map.current?.animateToRegion(
        { ...position, latitudeDelta: 0.012, longitudeDelta: 0.012 },
        500,
      );
  }, [ready, follow, position, coordinates]);
  const message =
    tracking.status === 'loading'
      ? 'Buscando sua localização…'
      : tracking.status === 'denied'
        ? 'Permita a localização para mostrar sua moto no mapa.'
        : tracking.status === 'disabled'
          ? 'Ative a localização do celular para mostrar sua posição.'
          : tracking.status === 'error'
            ? 'Não foi possível obter sua localização. Tente novamente.'
            : tracking.position?.accuracy && tracking.position.accuracy > 100
              ? 'Sua localização está aproximada.'
              : 'Sua localização atual';
  return (
    <View style={styles.container}>
      <MapView
        key={mapAttempt}
        ref={map}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        mapPadding={{ top: 0, left: 0, right: 0, bottom: bottomInset }}
        userInterfaceStyle={scheme === 'dark' ? 'dark' : 'light'}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onMapReady={() => {
          setReady(true);
          // Apple Maps does not emit onMapLoaded; only Google Maps supports it.
          if (Platform.OS === 'ios') {
            setLoaded(true);
            setMapTimeout(false);
          }
        }}
        onMapLoaded={() => {
          setLoaded(true);
          setMapTimeout(false);
        }}
        onPanDrag={() => setFollow(false)}
        accessibilityLabel="Mapa da localização do entregador"
      >
        {coordinates && (
          <Polyline coordinates={coordinates} strokeColor={theme.primary} strokeWidth={5} />
        )}
        {coordinates && (
          <Marker
            coordinate={coordinates[coordinates.length - 1]}
            title={target?.leg === 'pickup' ? 'Estabelecimento' : 'Destino da entrega'}
            description={target?.label}
          />
        )}
        {position && active && tracking.status === 'ready' && <MotoMarker coordinate={position} />}
      </MapView>
      {!loaded && !mapTimeout && (
        <View pointerEvents="none" style={styles.mapLoading}>
          <ActivityIndicator color={theme.primary} accessibilityLabel="Carregando mapa" />
        </View>
      )}
      {mapTimeout && !loaded && (
        <View style={[styles.mapWarning, { backgroundColor: theme.surface }]}>
          <Copy>O mapa está demorando para carregar. Tente recarregar.</Copy>
          <Button
            title="Recarregar mapa"
            secondary
            onPress={() => {
              setReady(false);
              setMapTimeout(false);
              setMapAttempt((value) => value + 1);
            }}
          />
        </View>
      )}
      <View style={[styles.status, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Copy muted>{message}</Copy>
        {target && (
          <>
            <Copy>
              {target.leg === 'pickup' ? 'Até o estabelecimento' : 'Até o endereço de entrega'}
            </Copy>
            {route.data ? (
              <Copy muted>
                {(route.data.distanceM / 1000).toFixed(1)} km · cerca de{' '}
                {Math.max(1, Math.ceil(route.data.durationSeconds / 60))} min
              </Copy>
            ) : route.loading ? (
              <Copy muted>Calculando trajeto…</Copy>
            ) : route.error ? (
              <>
                <Copy muted>{route.error.message}</Copy>
                <Button secondary title="Tentar rota novamente" onPress={route.retry} />
              </>
            ) : Platform.OS !== 'android' ? (
              <Copy muted>Use Abrir navegação para seguir até o endereço.</Copy>
            ) : null}
          </>
        )}
        {tracking.status === 'denied' ? (
          <Button
            title="Permitir localização"
            secondary
            onPress={() => {
              if (tracking.canAskAgain) {
                void Location.requestForegroundPermissionsAsync()
                  .then(() => setAttempt((a) => a + 1))
                  .catch(() => setTracking({ status: 'error' }));
              } else void Linking.openSettings().catch(() => setTracking({ status: 'error' }));
            }}
          />
        ) : (
          (tracking.status === 'error' || tracking.status === 'disabled') && (
            <Button
              title="Tentar localização novamente"
              secondary
              onPress={() => setAttempt((a) => a + 1)}
            />
          )
        )}
      </View>
      {position && (
        <View style={[styles.recenter, { bottom: bottomInset + 16 }]}>
          <Button
            title="Minha localização"
            secondary
            onPress={() => {
              setFollow(true);
              if (coordinates)
                map.current?.fitToCoordinates(coordinates, {
                  edgePadding: { top: 130, left: 40, right: 40, bottom: 80 },
                  animated: true,
                });
              else
                map.current?.animateToRegion(
                  { ...position, latitudeDelta: 0.012, longitudeDelta: 0.012 },
                  400,
                );
            }}
          />
        </View>
      )}
    </View>
  );
});
const MotoMarker = memo(function MotoMarker({ coordinate }: { coordinate: LatLng }) {
  const theme = useTheme();
  const [trackingView, setTrackingView] = useState(true);
  useEffect(() => {
    setTrackingView(true);
    const timer = setTimeout(() => setTrackingView(false), 500);
    return () => clearTimeout(timer);
  }, [theme]);
  return (
    <Marker
      coordinate={coordinate}
      tracksViewChanges={trackingView}
      anchor={{ x: 0.5, y: 0.5 }}
      title="Você está aqui"
      description="Localização do seu aparelho"
    >
      <View
        collapsable={false}
        style={[styles.moto, { backgroundColor: theme.surface, borderColor: theme.primary }]}
      >
        <Text style={{ fontSize: 30 }} accessibilityLabel="Sua moto">
          🏍️
        </Text>
      </View>
    </Marker>
  );
});
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 180, overflow: 'hidden' },
  map: { flex: 1, width: '100%' },
  mapLoading: { position: 'absolute', top: '50%', left: '50%' },
  mapWarning: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '40%',
    padding: 12,
    borderRadius: 16,
    gap: 8,
  },
  moto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  recenter: { position: 'absolute', right: 16, bottom: 16 },
});
