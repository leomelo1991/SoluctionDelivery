import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  APIProvider,
  Map as GoogleMap,
  Marker,
  InfoWindow,
  useMap,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import type { MapPoint, OperationsMapSnapshot, User } from '@solution/contracts';
import { Button, Card, ErrorState, Loading } from '@solution/ui';
import { api, ApiError } from '../lib/api';
import { actorScope } from '../lib/query';
const key = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
  .VITE_GOOGLE_MAPS_KEY;
const latLng = (p: MapPoint) => ({ lat: p.latitude, lng: p.longitude });
type Pin = {
  id: string;
  title: string;
  detail: string;
  point: MapPoint;
  color: string;
  label: string;
};
function MapContents({ pins, fit }: { pins: Pin[]; fit: number }) {
  const map = useMap();
  const fitted = useRef(-1);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = pins.find((p) => p.id === selectedId);
  useEffect(() => {
    if (!map || !pins.length || fitted.current === fit) return;
    fitted.current = fit;
    if (pins.length === 1) {
      map.setCenter(latLng(pins[0].point));
      map.setZoom(15);
    } else {
      const bounds = new google.maps.LatLngBounds();
      pins.forEach((p) => bounds.extend(latLng(p.point)));
      map.fitBounds(bounds, 60);
    }
  }, [map, pins, fit]);
  if (!map) return null;
  return (
    <>
      {pins.map((p) => (
        <Marker
          key={p.id}
          position={latLng(p.point)}
          title={p.title}
          onClick={() => setSelectedId(p.id)}
          zIndex={p.label === 'M' ? 30 : p.label === 'E' ? 20 : 10}
          label={{ text: p.label, color: '#fff', fontWeight: '700' }}
          icon={{
            path: 'M 0,-22 C -13,-22 -18,-12 -18,-4 C -18,8 0,24 0,24 C 0,24 18,8 18,-4 C 18,-12 13,-22 0,-22 Z',
            fillColor: p.color,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 1,
            labelOrigin: new google.maps.Point(0, -4),
          }}
        />
      ))}
      {selected && (
        <InfoWindow position={latLng(selected.point)} onCloseClick={() => setSelectedId(undefined)}>
          <div className="operation-map-info">
            <strong>{selected.title}</strong>
            <p>{selected.detail}</p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
function MapLoading() {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE)
    return (
      <p role="alert">
        Não foi possível carregar o mapa. A lista da operação continua disponível abaixo.
      </p>
    );
  if (status !== APILoadingStatus.LOADED) return <p role="status">Carregando mapa…</p>;
  return null;
}
export function OperationsMap({ user }: { user: User }) {
  const [visible, setVisible] = useState(!document.hidden);
  const [now, setNow] = useState(Date.now());
  const [fit, setFit] = useState(0);
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
        {key ? (
          <APIProvider apiKey={key} language="pt-BR" region="BR">
            <MapLoading />
            <GoogleMap
              className="operation-map"
              defaultCenter={{ lat: -20.5386, lng: -47.4009 }}
              defaultZoom={13}
              gestureHandling="cooperative"
              disableDefaultUI={false}
            >
              <MapContents pins={pins} fit={fit} />
            </GoogleMap>
          </APIProvider>
        ) : (
          <p role="status">
            O mapa ainda não está habilitado neste painel. Os dados da operação estão disponíveis na
            lista abaixo.
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
