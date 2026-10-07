import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { Dashboard, Delivery, Establishment, Page, User } from '@solution/contracts';
import { money, dateTime, today } from '@solution/contracts';
import { Button, Empty, ErrorState, Loading, Metric, Pagination, Status } from '@solution/ui';
import { useAction, useData } from '../lib/query';
import { params } from '../lib/api';
import { CreateDelivery } from '../components/CreateDelivery';
import { DeliveryBoard, DeliveryDetails, DeliveryStatus } from '../components/Delivery';
export function Operations({ user, overview = false }: { user: User; overview?: boolean }) {
  const [view, setView] = useState('active');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const period = {
    from: from ? new Date(`${from}T00:00:00-03:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59-03:00`).toISOString() : undefined,
  };
  const deliveries = useData<Page<Delivery>>(
    '/deliveries' +
      params({
        page,
        pageSize: 30,
        q: search,
        status: status || view,
        ...(view === 'delivered' ? period : {}),
      }),
  );
  const dashboard = useData<Dashboard>('/dashboard' + params(period));
  const store = useData<Establishment>(
    '/establishments/' + user.establishmentId,
    user.role === 'establishment',
  );
  const action = useAction();
  const d = dashboard.data;
  return (
    <div className="stack page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {user.role === 'admin'
              ? 'CENTRAL DA OPERAÇÃO'
              : (store.data?.name ?? 'SEU ESTABELECIMENTO')}
          </p>
          <h1>{overview ? 'Visão geral' : 'Gestão de entregas'}</h1>
          <p className="muted">
            {overview
              ? 'Acompanhe parceiros, entregadores e o andamento das entregas.'
              : 'Uma operação conectada, da solicitação à entrega.'}
          </p>
        </div>
        <div className="actions">
          {store.data && (
            <Button
              variant="secondary"
              disabled={action.isPending}
              onClick={() => {
                const open = store.data!.operationOpen;
                if (
                  !open ||
                  window.confirm(
                    'Pausar impede novas solicitações e ofertas. Entregas já atribuídas continuam em andamento. Deseja pausar?',
                  )
                )
                  void action
                    .mutateAsync({
                      path: '/establishments/' + store.data!.id,
                      method: 'PATCH',
                      body: { operationOpen: !open },
                    })
                    .catch(() => undefined);
              }}
            >
              <Status tone={store.data.operationOpen ? 'positive' : 'neutral'}>
                {store.data.operationOpen ? 'Operação ativa' : 'Operação pausada'}
              </Status>
            </Button>
          )}
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} />
            Nova entrega
          </Button>
        </div>
      </div>
      <div className="period">
        <span>Período dos indicadores</span>
        <label>
          De
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value || today())} />
        </label>
        <label>
          Até
          <input type="date" value={to} onChange={(e) => setTo(e.target.value || today())} />
        </label>
        {d && (
          <small>
            {dateTime(d.period.from)} — {dateTime(d.period.to)}
          </small>
        )}
      </div>
      {dashboard.error ? (
        <ErrorState message={dashboard.error.message} retry={() => void dashboard.refetch()} />
      ) : (
        <div className="metrics">
          <Metric
            label="Em andamento"
            value={d?.active ?? '—'}
            context="Todas as entregas ativas"
          />
          <Metric label="Concluídas" value={d?.delivered ?? '—'} context="No período selecionado" />
          <Metric
            label="Fretes em andamento"
            value={d ? money(d.activeFreightCents) : '—'}
            context="Valores previstos"
          />
          <Metric
            label="Fretes concluídos"
            value={d ? money(d.completedFreightCents ?? 0) : '—'}
            context="Sem deduzir custos ou repasses"
          />
        </div>
      )}
      {overview && d && (
        <div className="overview-grid">
          <section className="card">
            <h3>Relacionamento com parceiros</h3>
            <div className="stats-list">
              {['lead', 'onboarding', 'active', 'paused'].map((s) => (
                <div className="row" key={s}>
                  <span>
                    {
                      (
                        {
                          lead: 'Prospects',
                          onboarding: 'Em implantação',
                          active: 'Parceiros ativos',
                          paused: 'Pausados',
                        } as Record<string, string>
                      )[s]
                    }
                  </span>
                  <strong>{d.establishments.find((g) => g.status === s)?.count ?? 0}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <h3>Rede de entregadores</h3>
            <div className="stats-list">
              {[
                [
                  'Disponíveis',
                  d.couriers
                    .filter((c) => c.availability === 'available')
                    .reduce((a, c) => a + c.count, 0),
                ],
                [
                  'Em entrega',
                  d.couriers
                    .filter((c) => c.availability === 'busy')
                    .reduce((a, c) => a + c.count, 0),
                ],
                [
                  'Aguardando aprovação',
                  d.couriers
                    .filter((c) => c.approval === 'pending')
                    .reduce((a, c) => a + c.count, 0),
                ],
              ].map(([label, count]) => (
                <div className="row" key={label}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      <div className="toolbar">
        <div className="segmented">
          <button
            className={view === 'active' ? 'selected' : ''}
            onClick={() => {
              setView('active');
              setStatus('');
              setPage(1);
            }}
          >
            Em andamento
          </button>
          <button
            className={view === 'delivered' ? 'selected' : ''}
            onClick={() => {
              setView('delivered');
              setStatus('');
              setPage(1);
            }}
          >
            Concluídas
          </button>
        </div>
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Buscar entrega"
            placeholder="Número, destinatário ou parceiro"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        {user.role === 'admin' && view === 'active' && (
          <select
            aria-label="Filtrar etapa"
            className="filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as etapas</option>
            {['waiting', 'assigned', 'accepted', 'arrived', 'collected'].map((s) => (
              <option key={s} value={s}>
                {
                  (
                    {
                      waiting: 'Aguardando entregador',
                      assigned: 'Aguardando aceite',
                      accepted: 'Aceita',
                      arrived: 'Na coleta',
                      collected: 'Em rota',
                    } as Record<string, string>
                  )[s]
                }
              </option>
            ))}
          </select>
        )}
      </div>
      {deliveries.isLoading ? (
        <Loading />
      ) : deliveries.error ? (
        <ErrorState message={deliveries.error.message} retry={() => void deliveries.refetch()} />
      ) : !deliveries.data?.items.length ? (
        <Empty
          title="Nenhuma entrega encontrada"
          description="Novas solicitações aparecerão aqui com o andamento atualizado."
        />
      ) : user.role === 'establishment' && view === 'active' ? (
        <DeliveryBoard items={deliveries.data.items} user={user} onDetails={setDetail} />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Entrega</th>
                <th>Estabelecimento / destinatário</th>
                <th>Entregador</th>
                <th>Etapa</th>
                <th className="numeric">Frete</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deliveries.data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>#{item.code}</strong>
                    <small>{dateTime(item.createdAt)}</small>
                  </td>
                  <td>
                    {item.establishment.name}
                    <small>{item.recipientName}</small>
                  </td>
                  <td>{item.courier?.name ?? 'Não atribuído'}</td>
                  <td>
                    <DeliveryStatus status={item.status} />
                  </td>
                  <td className="numeric">{money(item.feeCents)}</td>
                  <td>
                    <Button variant="secondary" onClick={() => setDetail(item.id)}>
                      Detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deliveries.data && <Pagination {...deliveries.data} onChange={setPage} />}{' '}
      {creating && <CreateDelivery user={user} onClose={() => setCreating(false)} />}{' '}
      {detail && <DeliveryDetails id={detail} user={user} onClose={() => setDetail(null)} />}
    </div>
  );
}
