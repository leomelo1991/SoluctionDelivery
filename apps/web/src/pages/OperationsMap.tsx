import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { divIcon, latLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type {
  MapPoint,
  OperationsMapSnapshot,
  OperationsMapRoute,
  User,
} from '@solution/contracts';
import { Button, Card, ErrorState, Loading } from '@solution/ui';
import { api, ApiError } from '../lib/api';
import { actorScope } from '../lib/query';
const latLng = (p: MapPoint): [number, number] => [p.latitude, p.longitude];
type Pin = {
  id: string;
  title: string;
  detail: string;
  point: MapPoint;
  color: string;
  label: string;
};
function MapContents({
  pins,
  fit,
  route,
}: {
  pins: Pin[];
  fit: number;
  route?: OperationsMapRoute;
}) {
  const map = useMap();
  const fitted = useRef(-1);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    if (!pins.length || fitted.current === fit) return;
    fitted.current = fit;
    if (pins.length === 1) map.setView(latLng(pins[0].point), 15);
    else
      map.fitBounds(latLngBounds(pins.map((p) => latLng(p.point))), {
        padding: [40, 40],
        maxZoom: 16,
      });
  }, [map, pins, fit]);
  useEffect(() => {
    if (route?.coordinates.length)
      map.fitBounds(latLngBounds(route.coordinates.map(latLng)), {
        padding: [40, 40],
        maxZoom: 16,
      });
  }, [map, route]);
  return (
    <>
      {route && (
        <Polyline
          positions={route.coordinates.map(latLng)}
          pathOptions={{
            color: '#087b69',
            weight: 5,
            dashArray: route.kind === 'connection' ? '10 10' : undefined,
          }}
        >
          <Popup>{route.notice}</Popup>
        </Polyline>
      )}

      {pins.map((p) => (
        <Marker
          key={p.id}
          position={latLng(p.point)}
          title={p.title}
          icon={divIcon({
            className: 'operation-map-pin',
            html: `<span style="background:${p.color}">${p.label}</span>`,
            iconSize: [32, 40],
            iconAnchor: [16, 40],
            popupAnchor: [0, -36],
          })}
        >
          <Popup>
            <strong>{p.title}</strong>
            <p>{p.detail}</p>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
export function OperationsMap({ user }: { user: User }) {
  const [visible, setVisible] = useState(!document.hidden);
  const [now, setNow] = useState(Date.now());
  const [fit, setFit] = useState(0);
  const [selectedDelivery, setSelectedDelivery] = useState('');
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    const change = () => {
      setVisible(!document.hidden);
      setNow(Date.now());
    };
    document.addEventListener('visibilitychange', change);
    const timer = setInterval(() => setNow(Date.now()), 2000);
    return () => {
      document.removeEventListener('visibilitychange', change);
      clearInterval(timer);
    };
  }, []);
  const snapshot = useQuery<OperationsMapSnapshot, ApiError>({
    queryKey: [actorScope(user), 'operations-map'],
    queryFn: () => api('/operations-map'),
    enabled: visible,
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    staleTime: 0,
    retry: false,
  });
  const data = snapshot.data;
  const resolver = useQuery<unknown, ApiError>({
    queryKey: [actorScope(user), 'operations-map-resolve'],
    queryFn: () => api('/operations-map/resolve', 'POST'),
    enabled:
      visible &&
      !!data?.geocodingEnabled &&
      !!data?.pins.some((p) => p.locationStatus === 'pending'),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    staleTime: 10000,
    retry: false,
  });
  const couriers = useMemo(
    () =>
      data?.couriers.filter(
        (c) =>
          Date.parse(data.generatedAt) +
            (now - snapshot.dataUpdatedAt) -
            Date.parse(c.observedAt) <=
          30000,
      ) ?? [],
    [data, now, snapshot.dataUpdatedAt],
  );
  const pins = useMemo<Pin[]>(
    () => [
      ...(data?.pins
        .filter((p) => p.point)
        .map((p) => ({
          id: p.id,
          title: p.label,
          detail: `${p.address} · ${p.kind === 'establishment' ? (p.active ? 'Operação aberta' : 'Operação fechada ou inativa') : p.active ? 'Etapa atual da rota' : 'Local da entrega'}`,
          point: p.point!,
          color:
            p.kind === 'establishment'
              ? p.active
                ? '#187343'
                : '#677481'
              : p.kind === 'pickup'
                ? '#975216'
                : '#6833a5',
          label: p.kind === 'establishment' ? 'E' : p.kind === 'pickup' ? 'C' : 'D',
        })) ?? []),
      ...couriers.map((c) => ({
        id: `courier:${c.id}`,
        title: c.name,
        point: c.point,
        label: 'M',
        color: '#1766bf',
        detail: `${c.leg === 'pickup' ? 'Em coleta' : c.leg === 'dropoff' ? 'Em entrega' : c.availability === 'busy' ? 'Em atendimento' : 'Disponível'} · ${data?.pins.find((p) => p.deliveryId === c.deliveryId && p.kind === c.leg)?.label ?? 'Sem rota aceita'} · GPS ${new Date(c.observedAt).toLocaleTimeString('pt-BR')} · precisão aproximada ${Math.round(c.accuracy)} m`,
      })),
    ],
    [data, couriers],
  );
  const deliveries = data?.pins.filter((p) => p.kind === 'dropoff') ?? [];
  const routeId = deliveries.some((p) => p.deliveryId === selectedDelivery)
    ? selectedDelivery
    : (deliveries.find((p) => p.active)?.deliveryId ?? deliveries[0]?.deliveryId ?? '');
  const routeReady =
    !!routeId && !!data?.pins.filter((p) => p.deliveryId === routeId).every((p) => p.point);
  const route = useQuery<OperationsMapRoute, ApiError>({
    queryKey: [
      actorScope(user),
      'operations-map-route',
      routeId,
      routeReady,
      data?.pins
        .filter((p) => p.deliveryId === routeId)
        .map((p) => p.active)
        .join(':'),
    ],
    queryFn: () => api(`/operations-map/routes/${routeId}`, 'POST'),
    enabled: visible && routeReady,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const missing = data?.pins.filter((p) => !p.point) ?? [];
  return (
    <div className="stack">
      <div className="stack">
        <p className="eyebrow">ACOMPANHAMENTO DA OPERAÇÃO</p>
        <h1>Mapa da operação</h1>
        <p className="muted">
          {user.role === 'admin'
            ? 'Estabelecimentos e entregadores da sua plataforma.'
            : 'Seu estabelecimento e os entregadores atendendo suas entregas.'}{' '}
          Atualização a cada 2 segundos enquanto a tela está visível.
        </p>
      </div>
      {snapshot.isLoading && <Loading />}
      {snapshot.error && (
        <ErrorState
          message={`Atualização interrompida. ${snapshot.error.message}`}
          retry={() => void snapshot.refetch()}
        />
      )}
      <Card>
        <div className="row">
          <div>
            <strong>{couriers.length} entregadores com GPS recente</strong>
            <p className="muted">
              {data
                ? `Última consulta: ${new Date(data.generatedAt).toLocaleTimeString('pt-BR')}`
                : 'Aguardando consulta.'}
            </p>
          </div>
          <Button variant="secondary" onClick={() => setFit((n) => n + 1)}>
            Enquadrar operação
          </Button>
        </div>
        <div className="operation-map-legend">
          <span>🟢 E · estabelecimento aberto</span>
          <span>⚪ E · fechado/inativo</span>
          <span>🔵 M · entregador</span>
          <span>🟤 C · coleta</span>
          <span>🟣 D · entrega</span>
        </div>
        {!!deliveries.length && (
          <div className="field">
            <label htmlFor="map-delivery">Entrega no mapa</label>
            <select
              id="map-delivery"
              value={routeId}
              onChange={(event) => setSelectedDelivery(event.target.value)}
            >
              {deliveries.map((p) => (
                <option key={p.id} value={p.deliveryId}>
                  {p.label}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={!routeReady || route.isFetching}
              onClick={() => void route.refetch()}
            >
              Atualizar trajeto
            </Button>
            {!routeReady && <p>Localizando os pontos da entrega…</p>}
            {route.isFetching && <p role="status">Calculando trajeto…</p>}
            {route.error && <p role="alert">{route.error.message}</p>}
            {route.data && routeReady && (
              <p role="status">
                {route.data.notice} {route.data.origin}.
                {route.data.approximate
                  ? ' Localização aproximada por CEP; não indica o número do imóvel.'
                  : ''}
              </p>
            )}
          </div>
        )}
        <MapContainer
          className="operation-map"
          center={[-20.5386, -47.4009]}
          zoom={13}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            eventHandlers={{
              tileerror: () => setTileError(true),
              tileload: () => setTileError(false),
            }}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapContents
            pins={pins}
            fit={fit}
            route={routeReady && !route.error ? route.data : undefined}
          />
        </MapContainer>
        {tileError && (
          <p role="alert">
            Não foi possível carregar o fundo do mapa. Confira sua conexão. Os dados da operação
            continuam disponíveis abaixo.
          </p>
        )}
        <p className="muted">
          Posições com mais de 30 segundos sem atualização deixam de aparecer. O movimento depende
          do GPS, da conexão e do aplicativo aberto no aparelho.
        </p>
      </Card>
      {data?.truncated && (
        <p role="alert">
          Exibindo os primeiros 1.000 registros de cada grupo. Esta visão não inclui toda a
          operação.
        </p>
      )}
      {data && !data.geocodingEnabled && (
        <p role="status">
          Localização por endereço ainda não habilitada. Os pins dos endereços aparecerão após a
          configuração do serviço de mapas.
        </p>
      )}
      {resolver.error && (
        <p role="alert">
          Não foi possível atualizar os locais dos endereços. Tentaremos novamente.
        </p>
      )}
      {!!missing.length && (
        <p role="status">
          {missing.length} locais ainda sem coordenadas confirmadas. Confira os endereços indicados
          abaixo.
        </p>
      )}
      <Card>
        <h2>Entregadores online</h2>
        {!couriers.length ? (
          <p className="muted">Nenhum entregador com posição recente disponível nesta operação.</p>
        ) : (
          <ul className="operation-map-list">
            {couriers.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong> ·{' '}
                {c.leg === 'pickup'
                  ? 'A caminho da coleta'
                  : c.leg === 'dropoff'
                    ? 'A caminho da entrega'
                    : c.availability === 'busy'
                      ? 'Em atendimento'
                      : 'Disponível'}{' '}
                · GPS {new Date(c.observedAt).toLocaleTimeString('pt-BR')}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2>
          {user.role === 'admin'
            ? 'Estabelecimentos e locais das entregas'
            : 'Seu estabelecimento e suas entregas'}
        </h2>
        <ul className="operation-map-list">
          {data?.pins.map((p) => (
            <li key={p.id}>
              <strong>{p.label}</strong>
              {p.kind === 'establishment'
                ? p.active
                  ? ' · Operação aberta'
                  : ' · Fechado/inativo'
                : p.active
                  ? ' · Etapa atual'
                  : ''}
              <p className="muted">{p.address}</p>
              {p.approximate && <small>Localização aproximada por CEP (BrasilAPI).</small>}
              {!p.point && (
                <small>
                  {p.locationStatus === 'unavailable'
                    ? 'Endereço não localizado ou serviço indisponível.'
                    : 'Aguardando localização do endereço.'}
                </small>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
