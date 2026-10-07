import { useState } from 'react';
import { useDraftState } from '../lib/drafts';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import type { Courier, Dashboard, Delivery, Offer, Page, User } from '@solution/contracts';
import { dateTime, formatAddress, labels, mapsLink, money, today } from '@solution/contracts';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  Loading,
  Metric,
  Modal,
  Pagination,
  Status,
} from '@solution/ui';
import { useAction, useData } from '../lib/query';
import { params } from '../lib/api';
import { DeliveryDetails, DeliveryStatus } from '../components/Delivery';
export function CourierApp({ user }: { user: User }) {
  const location = useLocation();
  const view = location.pathname.endsWith('concluidas')
    ? 'history'
    : location.pathname.endsWith('entrega')
      ? 'active'
      : 'offers';
  const [page, setPage] = useState(1);
  const [accept, setAccept] = useState<Offer | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [from, setFrom] = useDraftState('courier:from', today);
  const [to, setTo] = useDraftState('courier:to', today);
  const period = {
    from: from ? new Date(`${from}T00:00:00-03:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59-03:00`).toISOString() : undefined,
  };
  const courier = useData<Courier>('/couriers/me');
  const offers = useData<Page<Offer>>('/couriers/me/offers' + params({ page }), view === 'offers');
  const active = useData<Page<Delivery>>('/deliveries?status=active');
  const history = useData<Page<Delivery>>(
    '/deliveries' + params({ status: 'delivered', page, ...period }),
    view === 'history',
  );
  const dashboard = useData<Dashboard>('/dashboard' + params(period), view === 'history');
  const action = useAction();
  const c = courier.data;
  const execute = async (offer: Offer, name: string) => {
    await action.mutateAsync({
      path: `/deliveries/${offer.id}/${name}`,
      body: { version: offer.version },
    });
    if (name === 'accept') {
      setAccept(null);
      setDetail(offer.id);
    }
  };
  const delivery = active.data?.items.find((d) => d.status !== 'assigned');
  return (
    <div className="courier-content stack">
      <div className="row">
        <div>
          <p className="eyebrow">SUA JORNADA</p>
          <h1>Olá, {user.name.split(' ')[0]}.</h1>
          <p className="muted">Uma entrega de cada vez, com tudo à mão.</p>
        </div>
      </div>
      {courier.error ? (
        <ErrorState message={courier.error.message} retry={() => void courier.refetch()} />
      ) : (
        c && (
          <Card>
            <div className="row">
              <div>
                <h3>
                  {c.approvalStatus === 'approved'
                    ? labels[c.availabilityStatus]
                    : labels[c.approvalStatus]}
                </h3>
                <p className="muted">
                  {c.approvalStatus === 'pending'
                    ? 'Seu cadastro aguarda aprovação.'
                    : c.approvalStatus === 'paused'
                      ? 'Fale com a operação para reativar seu cadastro.'
                      : c.availabilityStatus === 'busy'
                        ? 'Você tem uma entrega reservada ou em andamento.'
                        : 'Ative sua disponibilidade para receber ofertas.'}
                </p>
              </div>
              <Button
                variant="secondary"
                role="switch"
                aria-checked={c.availabilityStatus === 'available'}
                aria-label="Disponível para receber entregas"
                disabled={
                  c.approvalStatus !== 'approved' ||
                  c.availabilityStatus === 'busy' ||
                  action.isPending
                }
                onClick={() =>
                  void action
                    .mutateAsync({
                      path: '/couriers/me/availability',
                      method: 'PATCH',
                      body: {
                        status: c.availabilityStatus === 'available' ? 'offline' : 'available',
                      },
                    })
                    .catch(() => undefined)
                }
              >
                {c.availabilityStatus === 'available' ? 'Ficar indisponível' : 'Ficar disponível'}
              </Button>
            </div>
          </Card>
        )
      )}
      <nav className="courier-tabs" aria-label="Áreas do entregador">
        <NavLink to="/entregador/ofertas" onClick={() => setPage(1)}>
          Ofertas
        </NavLink>
        <NavLink to="/entregador/entrega" onClick={() => setPage(1)}>
          Minha entrega
        </NavLink>
        <NavLink to="/entregador/concluidas" onClick={() => setPage(1)}>
          Concluídas
        </NavLink>
      </nav>
      {view === 'offers' && (
        <>
          <div className="row">
            <h2>Entregas disponíveis</h2>
            <span className="muted">{offers.data?.total ?? 0} ofertas</span>
          </div>
          {offers.isLoading ? (
            <Loading />
          ) : offers.error ? (
            <ErrorState message={offers.error.message} retry={() => void offers.refetch()} />
          ) : offers.data?.items.length ? (
            offers.data.items.map((o) => (
              <Card className="offer" key={o.id}>
                <div className="row">
                  <span>#{o.code}</span>
                  <Status>
                    {o.status === 'assigned' ? 'Direcionada para você' : 'Oferta aberta'}
                  </Status>
                </div>
                <strong className="offer-value">{money(o.courierPayoutCents)}</strong>
                <p className="muted">Remuneração prevista</p>
                <div className="offer-route">
                  <div>
                    <MapPin size={18} />
                    <div>
                      <h3>{o.establishment.name}</h3>
                      <p>{formatAddress(o.pickupAddress)}</p>
                    </div>
                  </div>
                  <div>
                    <MapPin size={18} />
                    <div>
                      <h3>Região de destino</h3>
                      <p>
                        {o.destinationRegion.district} · {o.destinationRegion.city}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="muted">
                  {o.manualDistanceM !== null
                    ? `${(o.manualDistanceM / 1000).toLocaleString('pt-BR')} km · informação manual`
                    : 'Distância e tempo indisponíveis'}{' '}
                  · {o.pickupReady ? 'Pedido pronto' : 'Prontidão não informada'}
                </p>
                <div className="actions">
                  <Button disabled={action.isPending} onClick={() => setAccept(o)}>
                    Aceitar entrega
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={action.isPending}
                    onClick={() => void execute(o, 'decline').catch(() => undefined)}
                  >
                    Recusar
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Empty
              title={
                c?.approvalStatus !== 'approved'
                  ? 'Cadastro não habilitado'
                  : c?.availabilityStatus === 'offline'
                    ? 'Você está indisponível'
                    : 'Nenhuma oferta agora'
              }
              description="As ofertas elegíveis da sua empresa aparecerão aqui."
            />
          )}
          {offers.data && <Pagination {...offers.data} onChange={setPage} />}
        </>
      )}
      {view === 'active' &&
        (active.isLoading ? (
          <Loading />
        ) : active.error ? (
          <ErrorState message={active.error.message} retry={() => void active.refetch()} />
        ) : delivery ? (
          <Card>
            <div className="row">
              <h2>Entrega #{delivery.code}</h2>
              <DeliveryStatus status={delivery.status} />
            </div>
            <div className="detail-section">
              <h3>{delivery.status === 'collected' ? 'Destino' : 'Coleta'}</h3>
              <p>
                {formatAddress(
                  delivery.status === 'collected'
                    ? delivery.destinationAddress
                    : delivery.pickupAddress,
                )}
              </p>
              <a
                href={mapsLink(
                  delivery.status === 'collected'
                    ? delivery.destinationAddress
                    : delivery.pickupAddress,
                )}
                target="_blank"
                rel="noreferrer"
              >
                Abrir endereço no Maps <ArrowUpRight size={14} />
              </a>
            </div>
            <p>{delivery.notes}</p>
            <Button onClick={() => setDetail(delivery.id)}>Acompanhar e avançar entrega</Button>
          </Card>
        ) : (
          <Empty
            title={
              active.data?.items.some((d) => d.status === 'assigned')
                ? 'Uma entrega aguarda seu aceite'
                : 'Nenhuma entrega em andamento'
            }
            description="Aceite uma oferta para iniciar sua próxima entrega."
            action={<NavLink to="/entregador/ofertas">Ver ofertas</NavLink>}
          />
        ))}
      {view === 'history' && (
        <>
          <h2>Entregas concluídas</h2>
          <div className="period">
            <label>
              De
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value || today());
                  setPage(1);
                }}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value || today());
                  setPage(1);
                }}
              />
            </label>
          </div>
          <Metric
            label="Remuneração prevista no período"
            value={money(dashboard.data?.expectedPayoutCents ?? 0)}
            context="Somatório previsto; não é saldo nem pagamento realizado."
          />
          {history.isLoading ? (
            <Loading />
          ) : history.error ? (
            <ErrorState message={history.error.message} retry={() => void history.refetch()} />
          ) : history.data?.items.length ? (
            history.data.items.map((d) => (
              <Card key={d.id}>
                <div className="row">
                  <strong>
                    #{d.code} · {d.establishment.name}
                  </strong>
                  <strong>{money(d.courierPayoutCents)}</strong>
                </div>
                <p className="muted">{dateTime(d.updatedAt)}</p>
                <Button variant="secondary" onClick={() => setDetail(d.id)}>
                  Ver histórico
                </Button>
              </Card>
            ))
          ) : (
            <Empty title="Seu histórico começa na primeira entrega" />
          )}
          {history.data && <Pagination {...history.data} onChange={setPage} />}
        </>
      )}
      {accept && (
        <Modal
          title="Aceitar esta entrega?"
          description="Confirme a remuneração e o percurso. O vínculo só será confirmado após a resposta da operação."
          open
          onClose={() => setAccept(null)}
        >
          <div className="stack">
            <strong className="offer-value">{money(accept.courierPayoutCents)}</strong>
            <p>Coleta: {accept.establishment.name}</p>
            <p>
              Destino: {accept.destinationRegion.district} · {accept.destinationRegion.city}
            </p>
            <Button
              disabled={action.isPending}
              onClick={() => void execute(accept, 'accept').catch(() => setAccept(null))}
            >
              Confirmar aceite
            </Button>
          </div>
        </Modal>
      )}
      {detail && <DeliveryDetails id={detail} user={user} onClose={() => setDetail(null)} />}
    </div>
  );
}
