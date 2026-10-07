import { useState } from 'react';
import { useDraftState } from '../lib/drafts';
import { Plus, Search } from 'lucide-react';
import type { Courier, Establishment, Page, User } from '@solution/contracts';
import { dateTime, formatAddress, labels, money, stageLabels } from '@solution/contracts';
import { Button, Empty, ErrorState, Loading, Modal, Pagination, Status } from '@solution/ui';
import { useAction, useData } from '../lib/query';
import { params } from '../lib/api';
import { Form, addressFields, omitAddress, takeAddress, type FormField } from '../components/Form';
const storeFields: FormField[] = [
  { name: 'name', label: 'Nome do estabelecimento', min: 2, max: 120 },
  { name: 'responsible', label: 'Responsável', min: 2, max: 120 },
  { name: 'phone', label: 'Telefone', min: 8, max: 25 },
  { name: 'email', label: 'E-mail', kind: 'email' },
  { name: 'acquisitionChannel', label: 'Canal de aquisição', default: 'direct' },
  ...addressFields,
];
const courierFields: FormField[] = [
  { name: 'name', label: 'Nome do entregador', min: 2, max: 120 },
  { name: 'phone', label: 'Telefone', min: 8, max: 25 },
  {
    name: 'vehicle',
    label: 'Veículo',
    kind: 'select',
    options: ['motorcycle', 'bicycle', 'car'].map((value) => ({ value, label: labels[value] })),
  },
];
export function Directory({ kind }: { kind: 'establishments' | 'couriers' }) {
  const [q, setQ] = useDraftState(`directory:${kind}:search`, '');
  const [filter, setFilter] = useDraftState(`directory:${kind}:filter`, '');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const stores = kind === 'establishments';
  const action = useAction();
  const query = useData<Page<Establishment | Courier>>(
    '/' + kind + params({ q, page, [stores ? 'lifecycleStatus' : 'approvalStatus']: filter }),
  );
  const entries = query.data?.items ?? [];
  return (
    <div className="stack page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">REDE E RELACIONAMENTO</p>
          <h1>{stores ? 'Estabelecimentos' : 'Entregadores'}</h1>
          <p className="muted">
            {stores
              ? 'Da primeira conversa à operação do parceiro.'
              : 'Cadastros, aprovação e disponibilidade da sua rede.'}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} />
          {stores ? 'Novo estabelecimento' : 'Novo entregador'}
        </Button>
      </div>
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Buscar cadastro"
            placeholder="Buscar por nome"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          className="filter"
          aria-label="Filtrar cadastro"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os cadastros</option>
          {(stores
            ? ['lead', 'onboarding', 'active', 'paused']
            : ['pending', 'approved', 'paused']
          ).map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : !entries.length ? (
        <Empty
          title={stores ? 'Nenhum estabelecimento' : 'Nenhum entregador'}
          description="Cadastre sua rede para começar a operação."
        />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>{stores ? 'Responsável / cidade' : 'Contato / veículo'}</th>
                <th>{stores ? 'Relacionamento' : 'Aprovação'}</th>
                <th>Operação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const store = e as Establishment;
                const courier = e as Courier;
                return (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.name}</strong>
                    </td>
                    <td>
                      {stores ? store.responsible : courier.phone}
                      <small>{stores ? store.city : labels[courier.vehicle]}</small>
                    </td>
                    <td>
                      <Status
                        tone={
                          (
                            stores
                              ? store.lifecycleStatus === 'active'
                              : courier.approvalStatus === 'approved'
                          )
                            ? 'positive'
                            : 'neutral'
                        }
                      >
                        {labels[stores ? store.lifecycleStatus : courier.approvalStatus]}
                      </Status>
                    </td>
                    <td>
                      {stores ? (
                        <Status tone={store.operationOpen ? 'positive' : 'neutral'}>
                          {store.operationOpen ? 'Aberta' : 'Pausada'}
                        </Status>
                      ) : (
                        <Status
                          tone={courier.availabilityStatus === 'available' ? 'positive' : 'neutral'}
                        >
                          {labels[courier.availabilityStatus]}
                        </Status>
                      )}
                    </td>
                    <td>
                      <Button variant="secondary" onClick={() => setDetail(e.id)}>
                        Ver perfil
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {query.data && <Pagination {...query.data} onChange={setPage} />}{' '}
      {creating && (
        <Modal
          title={stores ? 'Cadastrar estabelecimento' : 'Cadastrar entregador'}
          description={
            stores
              ? 'O cadastro começa como prospect e com operação fechada.'
              : 'O cadastro começa aguardando aprovação e indisponível.'
          }
          open
          onClose={() => setCreating(false)}
        >
          <Form
            draftKey={`directory:${kind}:create`}
            fields={stores ? storeFields : courierFields}
            busy={action.isPending}
            onSubmit={async (v) => {
              const body = stores
                ? { ...omitAddress(v), city: v.city, address: takeAddress(v) }
                : v;
              await action.mutateAsync({ path: '/' + kind, body });
              setCreating(false);
            }}
          />
        </Modal>
      )}
      {detail &&
        (stores ? (
          <EstablishmentProfile id={detail} onClose={() => setDetail(null)} />
        ) : (
          <CourierProfile id={detail} onClose={() => setDetail(null)} />
        ))}{' '}
    </div>
  );
}
function EstablishmentProfile({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useData<Establishment>('/establishments/' + id);
  const action = useAction();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useDraftState(`establishment:${id}:note`, '');
  const e = query.data;
  return (
    <Modal title={e?.name ?? 'Perfil do estabelecimento'} open onClose={onClose}>
      {query.error && !e ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : !e ? (
        <Loading />
      ) : (
        <div className="stack">
          {query.error && (
            <ErrorState message={query.error.message} retry={() => void query.refetch()} />
          )}
          <div className="row">
            <Status tone={e.lifecycleStatus === 'active' ? 'positive' : 'neutral'}>
              {labels[e.lifecycleStatus]}
            </Status>
            <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Fechar edição' : 'Editar cadastro'}
            </Button>
          </div>
          {editing ? (
            <Form
              draftKey={`establishment:${id}:edit`}
              fields={storeFields}
              initial={{ ...e, ...e.address }}
              onSubmit={async (v) => {
                await action.mutateAsync({
                  path: '/establishments/' + id,
                  method: 'PATCH',
                  body: { ...omitAddress(v), city: v.city, address: takeAddress(v) },
                });
                setEditing(false);
              }}
            />
          ) : (
            <>
              <p>
                {e.responsible} · {e.phone}
              </p>
              <p>{e.email}</p>
              <p className="muted">{formatAddress(e.address)}</p>
            </>
          )}
          <label htmlFor="lifecycle">Etapa do relacionamento</label>
          <select
            id="lifecycle"
            value={e.lifecycleStatus}
            disabled={action.isPending}
            onChange={(ev) => {
              const value = ev.target.value;
              if (
                value !== 'paused' ||
                window.confirm(
                  'Pausar o parceiro fecha a operação para novas solicitações. Entregas vinculadas continuam. Confirmar?',
                )
              )
                void action
                  .mutateAsync({
                    path: '/establishments/' + id,
                    method: 'PATCH',
                    body: { lifecycleStatus: value },
                  })
                  .catch(() => undefined);
            }}
          >
            {['lead', 'onboarding', 'active', 'paused'].map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
          {e.lifecycleStatus === 'active' && (
            <Button
              variant="secondary"
              disabled={action.isPending}
              onClick={() => {
                if (
                  !e.operationOpen ||
                  window.confirm(
                    'Pausar impede novas solicitações e ofertas abertas. Entregas já atribuídas continuam. Confirmar?',
                  )
                )
                  void action
                    .mutateAsync({
                      path: '/establishments/' + id,
                      method: 'PATCH',
                      body: { operationOpen: !e.operationOpen },
                    })
                    .catch(() => undefined);
              }}
            >
              {e.operationOpen ? 'Pausar operação' : 'Abrir operação'}
            </Button>
          )}
          <div className="detail-section">
            <h3>Anotações de relacionamento</h3>
            <label className="sr-only" htmlFor="crm-note">
              Nova anotação
            </label>
            <textarea
              id="crm-note"
              value={note}
              maxLength={4000}
              onChange={(ev) => setNote(ev.target.value)}
              placeholder="Contato realizado ou próximo passo"
            />
            <Button
              disabled={!note.trim() || action.isPending}
              onClick={() =>
                void action
                  .mutateAsync({ path: `/establishments/${id}/notes`, body: { text: note } })
                  .then(() => setNote(''))
                  .catch(() => undefined)
              }
            >
              Registrar nota
            </Button>
            <div className="stack">
              {e.notes?.length ? (
                e.notes.map((n) => (
                  <div className="note" key={n.id}>
                    <p>{n.text}</p>
                    <small>
                      {n.authorName} · {dateTime(n.createdAt)}
                    </small>
                  </div>
                ))
              ) : (
                <p className="muted">Nenhuma anotação registrada.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
function CourierProfile({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useData<Courier>('/couriers/' + id);
  const action = useAction();
  const c = query.data;
  return (
    <Modal title={c?.name ?? 'Perfil do entregador'} open onClose={onClose}>
      {query.error ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : !c ? (
        <Loading />
      ) : (
        <div className="stack">
          <div className="row">
            <Status>{labels[c.approvalStatus]}</Status>
            <Status tone={c.availabilityStatus === 'available' ? 'positive' : 'neutral'}>
              {labels[c.availabilityStatus]}
            </Status>
          </div>
          <p>
            {c.phone} · {labels[c.vehicle]}
          </p>
          <div className="actions">
            {c.approvalStatus !== 'approved' ? (
              <Button
                disabled={action.isPending}
                onClick={() =>
                  void action
                    .mutateAsync({
                      path: `/couriers/${id}/approval-actions`,
                      body: { status: 'approved' },
                    })
                    .catch(() => undefined)
                }
              >
                {c.approvalStatus === 'paused' ? 'Reativar cadastro' : 'Aprovar cadastro'}
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={action.isPending || c.availabilityStatus === 'busy'}
                onClick={() => {
                  if (window.confirm('Pausar impede o recebimento de ofertas. Confirmar pausa?'))
                    void action
                      .mutateAsync({
                        path: `/couriers/${id}/approval-actions`,
                        body: { status: 'paused' },
                      })
                      .catch(() => undefined);
                }}
              >
                Pausar cadastro
              </Button>
            )}
          </div>
          <h3>Entregas recentes</h3>
          {c.deliveries?.length ? (
            c.deliveries.map((d) => (
              <div className="row note" key={d.id}>
                <span>
                  #{d.code} · {dateTime(d.createdAt)}
                </span>
                <span>
                  {stageLabels[d.status]} · {money(d.courierPayoutCents)}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">Nenhuma entrega registrada.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
export function Users({ user }: { user: User }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useDraftState('users:search', '');
  const [creating, setCreating] = useState(false);
  const [reset, setReset] = useState<User | null>(null);
  const [role, setRole] = useDraftState('users:create:role', 'admin');
  const query = useData<Page<User>>('/users' + params({ page, q }));
  const action = useAction();
  const fields: FormField[] = [
    { name: 'name', label: 'Nome', min: 2, max: 120 },
    { name: 'email', label: 'E-mail', kind: 'email' },
    {
      name: 'temporaryPassword',
      label: 'Senha inicial (mínimo 12 caracteres)',
      kind: 'password',
      min: 12,
      max: 128,
      full: true,
    },
    ...(role === 'establishment'
      ? [
          {
            name: 'establishmentId',
            label: 'Estabelecimento',
            kind: 'select' as const,
            source: '/establishments',
          },
        ]
      : role === 'courier'
        ? [{ name: 'courierId', label: 'Entregador', kind: 'select' as const, source: '/couriers' }]
        : []),
  ];
  return (
    <div className="stack page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACESSOS DA EMPRESA</p>
          <h1>Usuários</h1>
          <p className="muted">Cada usuário recebe um perfil e acesso à sua operação.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={18} />
          Novo usuário
        </Button>
      </div>
      <label className="search">
        <Search size={18} />
        <input
          aria-label="Buscar usuário"
          placeholder="Buscar nome ou e-mail"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <small>{u.email}</small>
                  </td>
                  <td>{labels[u.role]}</td>
                  <td>
                    <Status tone={u.active ? 'positive' : 'neutral'}>
                      {u.active ? 'Ativo' : 'Desativado'}
                    </Status>
                  </td>
                  <td>
                    <div className="actions">
                      <Button variant="secondary" onClick={() => setReset(u)}>
                        Redefinir senha
                      </Button>
                      <Button
                        variant={u.active ? 'danger' : 'secondary'}
                        disabled={u.id === user.id || action.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `${u.active ? 'Desativar' : 'Reativar'} o acesso de ${u.name}?`,
                            )
                          )
                            void action
                              .mutateAsync({
                                path: '/users/' + u.id,
                                method: 'PATCH',
                                body: { active: !u.active },
                              })
                              .catch(() => undefined);
                        }}
                      >
                        {u.active ? 'Desativar' : 'Reativar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data && <Pagination {...query.data} onChange={setPage} />}
      {creating && (
        <Modal
          title="Novo usuário"
          description="Compartilhe a senha inicial por um canal seguro. A troca será obrigatória no primeiro acesso."
          open
          onClose={() => setCreating(false)}
        >
          <div className="field">
            <label htmlFor="user-role">Perfil</label>
            <select id="user-role" value={role} onChange={(e) => setRole(e.target.value)}>
              {['admin', 'establishment', 'courier'].map((r) => (
                <option key={r} value={r}>
                  {labels[r]}
                </option>
              ))}
            </select>
          </div>
          <Form
            draftKey={`users:create:${role}`}
            key={role}
            fields={fields}
            onSubmit={async (v) => {
              await action.mutateAsync({ path: '/users', body: { ...v, role } });
              setCreating(false);
            }}
          />
        </Modal>
      )}
      {reset && (
        <Modal
          title={`Redefinir senha de ${reset.name}`}
          description="Sessões existentes serão encerradas e a troca da senha será obrigatória."
          open
          onClose={() => setReset(null)}
        >
          <Form
            fields={[
              {
                name: 'temporaryPassword',
                label: 'Nova senha inicial',
                kind: 'password',
                min: 12,
                max: 128,
              },
            ]}
            onSubmit={async (v) => {
              await action.mutateAsync({ path: `/users/${reset.id}/reset-password`, body: v });
              setReset(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
export function Audit() {
  const [page, setPage] = useState(1);
  const query = useData<
    Page<{
      id: string;
      entity: string;
      action: string;
      actorUserId: string | null;
      createdAt: string;
      reason?: string;
    }>
  >('/audit' + params({ page }));
  return (
    <div className="stack page-stack">
      <div>
        <p className="eyebrow">RASTREABILIDADE</p>
        <h1>Auditoria</h1>
        <p className="muted">Alterações e ações registradas na sua empresa.</p>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Entidade</th>
                <th>Ação</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((e) => (
                <tr key={e.id}>
                  <td>{dateTime(e.createdAt)}</td>
                  <td>
                    {(
                      {
                        user: 'Usuário',
                        tenant: 'Empresa',
                        establishment: 'Estabelecimento',
                        courier: 'Entregador',
                        delivery: 'Entrega',
                        quote: 'Cotação',
                        region: 'Região',
                        surcharge: 'Acréscimo',
                        pricing: 'Tarifa',
                      } as Record<string, string>
                    )[e.entity] ?? 'Registro'}
                  </td>
                  <td>
                    {(
                      {
                        created: 'Cadastro criado',
                        updated: 'Cadastro atualizado',
                        assign: 'Atribuição',
                        accept: 'Aceite',
                        decline: 'Recusa',
                        arrive: 'Chegada à coleta',
                        collect: 'Retirada',
                        complete: 'Conclusão',
                        offer_declined: 'Oferta recusada',
                        note_created: 'Nota registrada',
                        approval_changed: 'Aprovação alterada',
                        availability_changed: 'Disponibilidade alterada',
                        active_changed: 'Acesso alterado',
                        password_changed: 'Senha alterada',
                        password_reset: 'Senha redefinida',
                        formula_updated: 'Fórmula atualizada',
                        routing_updated: 'Provedor atualizado',
                        manual_distance: 'Distância manual',
                        provisioned: 'Empresa provisionada',
                        demo_seed: 'Demonstração criada',
                      } as Record<string, string>
                    )[e.action] ?? 'Alteração registrada'}
                  </td>
                  <td>{e.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data && <Pagination {...query.data} onChange={setPage} />}
    </div>
  );
}
