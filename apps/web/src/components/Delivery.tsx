import { ArrowUpRight, MapPin, PackageCheck } from 'lucide-react';
import type { Delivery, Stage, User } from '@solution/contracts';
import { dateTime, formatAddress, mapsLink, money, stageLabels } from '@solution/contracts';
import { Button, Card, Empty, ErrorState, Loading, Modal, Status } from '@solution/ui';
import { AsyncSelect } from './AsyncSelect';
import { useAction, useData } from '../lib/query';
import { useDraftState } from '../lib/drafts';
export function DeliveryStatus({ status }: { status: Stage }) {
  return (
    <Status tone={status === 'delivered' ? 'positive' : 'neutral'}>{stageLabels[status]}</Status>
  );
}
export function DeliveryCard({
  delivery: d,
  user,
  onDetails,
}: {
  delivery: Delivery;
  user: User;
  onDetails: (id: string) => void;
}) {
  return (
    <Card className="delivery-card">
      <div className="row">
        <strong>#{d.code}</strong>
        <DeliveryStatus status={d.status} />
      </div>
      <h3>{d.recipientName}</h3>
      <p className="muted">{d.establishment.name}</p>
      <div className="address-line">
        <MapPin size={16} />
        <span>{formatAddress(d.destinationAddress)}</span>
      </div>
      <p className="muted">{d.courier?.name ?? 'Aguardando atribuição'}</p>
      <div className="row card-footer">
        <strong>{money(user.role === 'courier' ? d.courierPayoutCents : d.feeCents)}</strong>
        <Button variant="secondary" onClick={() => onDetails(d.id)}>
          Ver detalhes
        </Button>
      </div>
    </Card>
  );
}
export function DeliveryDetails({
  id,
  user,
  onClose,
}: {
  id: string;
  user: User;
  onClose: () => void;
}) {
  const query = useData<Delivery>('/deliveries/' + id);
  const action = useAction();
  const [courierId, setCourier] = useDraftState(`delivery:${id}:courier`, '');
  const [reason, setReason] = useDraftState(
    `delivery:${id}:${query.data?.status ?? 'loading'}:reason`,
    '',
  );
  const d = query.data;
  const execute = async (name: string) => {
    if (!d) return;
    await action.mutateAsync({
      path: `/deliveries/${id}/${name}`,
      body: {
        version: d.version,
        ...(name === 'assign' ? { courierId } : {}),
        ...(user.role === 'admin' && name !== 'assign' ? { reason } : {}),
      },
    });
    if (name === 'assign') setCourier('');
    else setReason('');
  };
  const next =
    d?.status === 'accepted'
      ? ['arrive', 'Cheguei ao estabelecimento']
      : d?.status === 'arrived'
        ? ['collect', 'Confirmar retirada']
        : d?.status === 'collected'
          ? ['complete', 'Confirmar entrega']
          : null;
  const canAct =
    user.role === 'courier' ||
    user.role === 'admin' ||
    (user.role === 'establishment' && d?.status === 'arrived');
  return (
    <Modal title={d ? `Entrega #${d.code}` : 'Detalhes da entrega'} open onClose={onClose}>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : (
        d && (
          <div className="stack">
            <DeliveryStatus status={d.status} />
            <div className="detail-section">
              <h3>Coleta · {d.establishment.name}</h3>
              <p>{formatAddress(d.pickupAddress)}</p>
              <h3>Destino · {d.recipientName}</h3>
              <p>{formatAddress(d.destinationAddress)}</p>
              <p>{d.recipientPhone}</p>
              <a
                href={mapsLink(d.status === 'collected' ? d.destinationAddress : d.pickupAddress)}
                target="_blank"
                rel="noreferrer"
              >
                Abrir endereço no Maps <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="row">
              <span>{user.role === 'courier' ? 'Remuneração prevista' : 'Frete cobrado'}</span>
              <strong>{money(user.role === 'courier' ? d.courierPayoutCents : d.feeCents)}</strong>
            </div>
            {user.role !== 'courier' && (
              <div className="row">
                <span>Remuneração do entregador</span>
                <strong>{money(d.courierPayoutCents)}</strong>
              </div>
            )}
            <p className="muted">
              {d.manualDistanceM !== null
                ? `${(d.manualDistanceM / 1000).toLocaleString('pt-BR')} km · distância manual`
                : 'Distância histórica indisponível'}{' '}
              · {d.courier?.name ?? 'Sem entregador'}
            </p>
            {d.notes && <p className="note">{d.notes}</p>}
            {d.status === 'waiting' && user.role !== 'courier' && (
              <div className="stack">
                <label htmlFor="assign-courier">Entregador disponível</label>
                <AsyncSelect
                  draftKey={`delivery:${id}:courier:search`}
                  id="assign-courier"
                  label="Entregador disponível"
                  source="/couriers?approvalStatus=approved&availabilityStatus=available"
                  value={courierId}
                  onChange={setCourier}
                />
                <Button
                  disabled={!courierId || action.isPending}
                  onClick={() => void execute('assign').catch(() => undefined)}
                >
                  Atribuir e solicitar aceite
                </Button>
              </div>
            )}
            {next && canAct && (
              <div className="stack">
                {user.role === 'admin' && (
                  <>
                    <label htmlFor="correction-reason">Motivo da correção administrativa</label>
                    <textarea
                      id="correction-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Descreva o motivo para registrar no histórico"
                    />
                  </>
                )}
                <Button
                  disabled={action.isPending || (user.role === 'admin' && reason.trim().length < 5)}
                  onClick={() => void execute(next[0]).catch(() => undefined)}
                >
                  <PackageCheck size={18} />
                  {user.role === 'admin' ? 'Registrar correção: ' : ''}
                  {next[1]}
                </Button>
              </div>
            )}
            <div className="detail-section">
              <h3>Histórico de etapas</h3>
              <ol className="timeline">
                {d.events?.map((e) => (
                  <li key={e.id}>
                    <strong>{stageLabels[e.newStatus]}</strong>
                    <small>
                      {dateTime(e.createdAt)} ·{' '}
                      {e.origin === 'admin'
                        ? 'Administrador'
                        : e.origin === 'courier'
                          ? 'Entregador'
                          : 'Estabelecimento'}
                    </small>
                    {e.reason && <p>{e.reason}</p>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )
      )}
    </Modal>
  );
}
export function DeliveryBoard({
  items,
  user,
  onDetails,
}: {
  items: Delivery[];
  user: User;
  onDetails: (id: string) => void;
}) {
  const groups: [string, Stage[]][] = [
    ['Aguardando entregador', ['waiting', 'assigned']],
    ['Em coleta', ['accepted', 'arrived']],
    ['Em rota', ['collected']],
  ];
  return (
    <div className="board">
      {groups.map(([label, statuses]) => {
        const list = items.filter((d) => statuses.includes(d.status));
        return (
          <section className="board-column" key={label}>
            <div className="column-heading">
              <h3>{label}</h3>
              <span>{list.length}</span>
            </div>
            <div className="stack">
              {list.map((d) => (
                <DeliveryCard key={d.id} delivery={d} user={user} onDetails={onDetails} />
              ))}
              {!list.length && <Empty title="Nenhuma entrega nesta etapa" />}
            </div>
          </section>
        );
      })}
    </div>
  );
}
