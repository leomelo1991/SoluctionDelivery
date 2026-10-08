import { FinanceEarnings } from './FinanceEarnings';
import { useState } from 'react';
import type {
  User,
  FinanceStatus,
  FinanceWalletView,
  FinancePage,
  FinanceStatementItem,
  FinanceReservationView,
  FinanceTopupView,
  FinanceSettlementView,
  FinanceTreasuryView,
  CommercialContract,
  Page,
} from '@solution/contracts';
import { financeMoney, dateTime } from '@solution/contracts';
import { Button, Card, ErrorState, Loading, Modal } from '@solution/ui';
import { Form } from '../components/Form';
import { AsyncSelect } from '../components/AsyncSelect';
import { useAction, useData } from '../lib/query';
import { useDraftState } from '../lib/drafts';
const reasons = { name: 'reason', label: 'Justificativa', min: 8, max: 500 };
const topupLabel = {
  pending: 'Aguardando processamento',
  unknown: 'Confirmação pendente',
  confirmed: 'Crédito simulado confirmado',
  rejected: 'Simulação recusada',
};
export function FinancePageView({ user }: { user: User }) {
  const [selected, setSelected] = useDraftState('finance:establishment', '');
  const [modal, setModal] = useState<
    'enable' | 'configure' | 'topup' | 'week' | 'delivery' | 'permission' | 'settle' | null
  >(null);
  const [closing, setClosing] = useState<FinanceReservationView | null>(null);
  const [statementCursor, setStatementCursor] = useState('');
  const [reservationCursor, setReservationCursor] = useState('');
  const [topupCursor, setTopupCursor] = useState('');
  const [settlementCursor, setSettlementCursor] = useState('');
  const status = useData<FinanceStatus>('/finance/status');
  const id = user.role === 'establishment' ? user.establishmentId : selected;
  const query = `?establishmentId=${id ?? ''}`;
  const wallet = useData<FinanceWalletView>(
    '/finance/wallet' + query,
    !!id && !!status.data?.enabled,
  );
  const enabled = !!wallet.data?.configured && !!status.data?.enabled;
  const statement = useData<FinancePage<FinanceStatementItem>>(
    '/finance/statement' + query + (statementCursor ? `&cursor=${statementCursor}` : ''),
    enabled,
  );
  const reservations = useData<FinancePage<FinanceReservationView>>(
    '/finance/reservations' + query + (reservationCursor ? `&cursor=${reservationCursor}` : ''),
    enabled,
  );
  const topups = useData<FinancePage<FinanceTopupView>>(
    '/finance/topups' + query + (topupCursor ? `&cursor=${topupCursor}` : ''),
    enabled,
  );
  const settlements = useData<FinancePage<FinanceSettlementView>>(
    '/finance/settlements' + query + (settlementCursor ? `&cursor=${settlementCursor}` : ''),
    enabled,
  );
  const contracts = useData<Page<CommercialContract>>(
    '/contracts?pageSize=100',
    modal === 'week' || modal === 'settle',
  );
  const treasury = useData<FinanceTreasuryView>(
    '/finance/treasury',
    user.role === 'admin' && !!status.data?.enabled,
  );
  const action = useAction();
  const manage = status.data?.canManage;
  const run = async (path: string, body: unknown) => {
    await action.mutateAsync({ path, body });
    setModal(null);
    setClosing(null);
    setStatementCursor('');
    setReservationCursor('');
    setTopupCursor('');
    setSettlementCursor('');
  };
  if (status.isLoading) return <Loading />;
  if (status.error)
    return <ErrorState message={status.error.message} retry={() => void status.refetch()} />;
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">FINANCEIRO</p>
        <h1>Saldo e compromissos</h1>
        <p className="muted">Acompanhe créditos, reservas e consumo por estabelecimento.</p>
      </div>
      <Card>
        <strong>Ambiente de simulação</strong>
        <p>
          Os valores desta tela são fictícios. Não representam recebimentos, cobranças ou pagamentos
          bancários. As entregas operacionais continuam funcionando normalmente.
        </p>
      </Card>
      {!status.data?.enabled ? (
        <Card>
          <p>O financeiro de simulação ainda não foi habilitado para esta empresa.</p>
          {user.role === 'admin' && (
            <Button onClick={() => setModal('enable')}>Habilitar simulação financeira</Button>
          )}
        </Card>
      ) : (
        <>
          {user.role === 'admin' && (
            <Card>
              <label htmlFor="finance-store">Estabelecimento</label>
              <AsyncSelect
                label="Estabelecimento"
                source="/establishments"
                id="finance-store"
                value={selected}
                onChange={(v) => {
                  setSelected(v);
                  setStatementCursor('');
                  setReservationCursor('');
                  setTopupCursor('');
                  setSettlementCursor('');
                }}
              />
              {manage && (
                <Button variant="secondary" onClick={() => setModal('permission')}>
                  Permissões financeiras
                </Button>
              )}
            </Card>
          )}
          {wallet.error && (
            <ErrorState message={wallet.error.message} retry={() => void wallet.refetch()} />
          )}
          {!!id && wallet.isLoading && <Loading />}
          {wallet.data && (
            <>
              <Card>
                <div className="row">
                  <h2>{wallet.data.establishment.name}</h2>
                  {manage && (
                    <Button variant="secondary" onClick={() => setModal('configure')}>
                      {!wallet.data.configured
                        ? 'Ativar carteira de simulação'
                        : wallet.data.enabled
                          ? 'Pausar novos compromissos'
                          : 'Retomar compromissos'}
                    </Button>
                  )}
                </div>
                <dl className="contract-summary">
                  <div>
                    <dt>Disponível simulado</dt>
                    <dd>{financeMoney(wallet.data.availableCents)}</dd>
                  </div>
                  <div>
                    <dt>Reservado simulado</dt>
                    <dd>{financeMoney(wallet.data.reservedCents)}</dd>
                  </div>
                </dl>
                <p className="muted">
                  {!wallet.data.configured
                    ? 'Carteira ainda não configurada.'
                    : wallet.data.enabled
                      ? 'Novos compromissos habilitados.'
                      : 'Novos compromissos pausados. Reservas existentes podem ser encerradas.'}
                </p>
                {manage && wallet.data.enabled && (
                  <div className="actions">
                    <Button onClick={() => setModal('topup')}>Simular crédito</Button>
                    <Button variant="secondary" onClick={() => setModal('week')}>
                      Reservar mínimo semanal
                    </Button>
                    <Button variant="secondary" onClick={() => setModal('delivery')}>
                      Reservar entrega
                    </Button>
                  </div>
                )}
              </Card>
              {enabled && (
                <>
                  <Card>
                    <div className="row">
                      <h2>Créditos simulados</h2>
                      {manage && (
                        <Button
                          disabled={action.isPending}
                          variant="secondary"
                          onClick={() => void run('/finance/process', {}).catch(() => undefined)}
                        >
                          Processar simulações pendentes
                        </Button>
                      )}
                    </div>
                    <p className="muted">
                      Créditos pendentes ou com confirmação incerta não entram no saldo. Depois de
                      uma falha simulada, aguarde alguns segundos e processe novamente.
                    </p>
                    {topups.error && (
                      <ErrorState
                        message={topups.error.message}
                        retry={() => void topups.refetch()}
                      />
                    )}
                    {!topups.data?.items.length && <p>Nenhum crédito nesta página.</p>}
                    {topups.data?.items.map((t) => (
                      <div key={t.id} className="finance-item">
                        <strong>{financeMoney(t.amountCents)}</strong>
                        <span>{topupLabel[t.status]}</span>
                        <small>
                          {t.reference} · {dateTime(t.createdAt)}
                        </small>
                      </div>
                    ))}
                    <Pager
                      cursor={topupCursor}
                      next={topups.data?.nextCursor}
                      set={setTopupCursor}
                    />
                  </Card>
                  <Card>
                    <h2>Fechamentos semanais</h2>
                    <p>
                      A apuração usa presença registrada e entregas com reserva financeira. A semana
                      precisa estar encerrada, com todos os turnos cadastrados e todas as entregas
                      reservadas concluídas.
                    </p>
                    {manage && (
                      <Button onClick={() => setModal('settle')}>Fechar semana simulada</Button>
                    )}
                    {settlements.error && (
                      <ErrorState
                        message={settlements.error.message}
                        retry={() => void settlements.refetch()}
                      />
                    )}
                    {settlements.data?.items.length === 0 && <p>Nenhuma semana fechada.</p>}
                    {settlements.data?.items.map((s) => (
                      <div className="finance-item" key={s.id}>
                        <strong>
                          Semana de {dateTime(s.weekStart)} · {financeMoney(s.totalCents)}
                        </strong>
                        <span>
                          Disponibilidade: {financeMoney(s.availabilityCents)} · Plataforma:{' '}
                          {financeMoney(s.platformCents)} · Entregas:{' '}
                          {financeMoney(s.variableCents)}
                        </span>
                        <span>
                          Capacidade prestada: {s.attendedMinutes}/{s.plannedMinutes} min · Crédito
                          liberado: {financeMoney(s.releasedCents)}
                        </span>
                      </div>
                    ))}
                  </Card>
                  <Pager
                    cursor={settlementCursor}
                    next={settlements.data?.nextCursor}
                    set={setSettlementCursor}
                  />
                  <Card>
                    <h2>Reservas</h2>
                    <p className="muted">
                      O mínimo semanal é reservado uma vez por versão e semana. Nas entregas com
                      contrato, a reserva considera somente a tarifa variável.
                    </p>
                    {reservations.error && (
                      <ErrorState
                        message={reservations.error.message}
                        retry={() => void reservations.refetch()}
                      />
                    )}
                    {!reservations.data?.items.length && <p>Nenhuma reserva nesta página.</p>}
                    {reservations.data?.items.map((v) => (
                      <div className="finance-item" key={v.id}>
                        <strong>
                          {v.kind === 'week' ? 'Mínimo semanal' : 'Entrega'} ·{' '}
                          {financeMoney(v.amountCents)}
                        </strong>
                        <span>
                          {v.status === 'reserved'
                            ? 'Reservado'
                            : `Encerrado · consumo simulado ${financeMoney(v.consumedCents)}`}
                        </span>
                        <small>{dateTime(v.createdAt)}</small>
                        {manage && v.status === 'reserved' && (
                          <Button variant="secondary" onClick={() => setClosing(v)}>
                            Encerrar reserva simulada
                          </Button>
                        )}
                      </div>
                    ))}
                    <Pager
                      cursor={reservationCursor}
                      next={reservations.data?.nextCursor}
                      set={setReservationCursor}
                    />
                  </Card>
                  <Card>
                    <h2>Extrato da simulação</h2>
                    {statement.error && (
                      <ErrorState
                        message={statement.error.message}
                        retry={() => void statement.refetch()}
                      />
                    )}
                    {!statement.data?.items.length && <p>Nenhum lançamento nesta página.</p>}
                    {statement.data?.items.map((t) => (
                      <div className="finance-item" key={t.id}>
                        <strong>{t.description}</strong>
                        <small>{dateTime(t.createdAt)}</small>
                        <span>Variação disponível: {financeMoney(t.availableDeltaCents)}</span>
                        <span>Variação reservada: {financeMoney(t.reservedDeltaCents)}</span>
                      </div>
                    ))}
                    <Pager
                      cursor={statementCursor}
                      next={statement.data?.nextCursor}
                      set={setStatementCursor}
                    />
                  </Card>
                </>
              )}
            </>
          )}
        </>
      )}
      {treasury.error && (
        <ErrorState message={treasury.error.message} retry={() => void treasury.refetch()} />
      )}
      {treasury.data && (
        <Card>
          <h2>Caixa e obrigações simulados</h2>
          <dl className="contract-summary">
            <div>
              <dt>Caixa</dt>
              <dd>{financeMoney(treasury.data.cashCents)}</dd>
            </div>
            <div>
              <dt>Créditos das lojas</dt>
              <dd>{financeMoney(treasury.data.merchantCreditCents)}</dd>
            </div>
            <div>
              <dt>Repasses pendentes</dt>
              <dd>{financeMoney(treasury.data.pendingPayoutCents)}</dd>
            </div>
            <div>
              <dt>Caixa livre</dt>
              <dd>{financeMoney(treasury.data.freeCashCents)}</dd>
            </div>
            <div>
              <dt>Devido aos entregadores</dt>
              <dd>{financeMoney(treasury.data.dueCents)}</dd>
            </div>
            <div>
              <dt>Receita apurada</dt>
              <dd>{financeMoney(treasury.data.revenueCents)}</dd>
            </div>
            <div>
              <dt>Custo apurado</dt>
              <dd>{financeMoney(treasury.data.costCents)}</dd>
            </div>
          </dl>
          <p>
            {treasury.data.accountingConsistent
              ? 'Conferência contábil sem divergências.'
              : 'Divergência contábil: revise antes de processar novos repasses.'}
          </p>
        </Card>
      )}
      {status.data?.enabled && user.role === 'admin' && <FinanceEarnings manage={!!manage} />}
      <Modal
        open={modal === 'enable'}
        onClose={() => setModal(null)}
        title="Habilitar simulação financeira"
      >
        <p>
          Você será o primeiro gestor financeiro da simulação. Nenhum dinheiro real será
          movimentado.
        </p>
        <Form
          fields={[reasons]}
          onSubmit={(b) => run('/finance/enable', b)}
          submitLabel="Habilitar simulação"
        />
      </Modal>
      <Modal
        open={modal === 'configure'}
        onClose={() => setModal(null)}
        title="Configurar carteira simulada"
      >
        <Form
          fields={[reasons]}
          onSubmit={(b) => run(`/finance/wallets/${id}`, { ...b, enabled: !wallet.data?.enabled })}
        />
      </Modal>
      <Modal
        open={modal === 'permission'}
        onClose={() => setModal(null)}
        title="Permissão de gestão financeira"
      >
        <Form
          fields={[
            { name: 'userId', label: 'Administrador', kind: 'select', source: '/users' },
            {
              name: 'enabled',
              label: 'Permissão de simulação',
              kind: 'select',
              options: [
                { value: 'yes', label: 'Conceder' },
                { value: 'no', label: 'Remover' },
              ],
            },
            reasons,
          ]}
          onSubmit={(b) => run('/finance/permissions', { ...b, enabled: b.enabled === 'yes' })}
        />
      </Modal>
      <Modal open={modal === 'topup'} onClose={() => setModal(null)} title="Simular crédito">
        <Form
          draftKey={`finance:topup:${id}`}
          fields={[
            {
              name: 'amountCents',
              label: 'Valor fictício (R$)',
              kind: 'money',
              min: 0.01,
              max: 1000000,
            },
            {
              name: 'reference',
              label: 'Referência única (8–80 letras, números, hífen ou sublinhado)',
              min: 8,
              max: 80,
            },
            {
              name: 'scenario',
              label: 'Resultado simulado',
              kind: 'select',
              options: [
                { value: 'approve', label: 'Aprovar' },
                { value: 'decline', label: 'Recusar' },
                {
                  value: 'timeout_after_accept',
                  label: 'Aceitar, perder resposta e recuperar por consulta',
                },
              ],
            },
            reasons,
          ]}
          onSubmit={(b) =>
            run('/finance/topups', {
              ...b,
              amountCents: String(b.amountCents),
              establishmentId: id,
            })
          }
          submitLabel="Criar crédito simulado"
        />
      </Modal>
      <Modal
        open={modal === 'week' || modal === 'settle'}
        onClose={() => setModal(null)}
        title={modal === 'settle' ? 'Fechar semana simulada' : 'Reservar mínimo semanal'}
      >
        <p>
          {modal === 'settle'
            ? 'O fechamento registra consumo e ganhos com base na presença e nas entregas reservadas. O demonstrativo é imutável. Política de simulação: disponibilidade e fixo proporcionais à presença; tarifa de plataforma integral.'
            : 'Será reservado o mínimo de disponibilidade mais a taxa de plataforma, sem o volume variável previsto. Semana completa de segunda a segunda, em São Paulo.'}
        </p>
        {contracts.error ? (
          <ErrorState message={contracts.error.message} retry={() => void contracts.refetch()} />
        ) : (
          <Form
            fields={[
              {
                name: 'versionId',
                label: 'Versão aceita',
                kind: 'select',
                options:
                  contracts.data?.items
                    .filter((c) => c.establishmentId === id)
                    .flatMap((c) =>
                      c.versions
                        .filter((v) => v.status === 'accepted')
                        .map((v) => ({ value: v.id, label: `${c.title} · v${v.number}` })),
                    ) ?? [],
              },
              { name: 'week', label: 'Segunda-feira (AAAA-MM-DD)', min: 10, max: 10 },
            ]}
            onSubmit={(b) =>
              run(modal === 'settle' ? '/finance/settlements' : '/finance/reservations/week', b)
            }
          />
        )}
      </Modal>
      <Modal open={modal === 'delivery'} onClose={() => setModal(null)} title="Reservar entrega">
        <Form
          fields={[
            {
              name: 'deliveryId',
              label: 'Entrega em andamento',
              kind: 'select',
              source: `/deliveries?status=active&establishmentId=${id}`,
            },
          ]}
          onSubmit={(b) => run('/finance/reservations/delivery', b)}
        />
      </Modal>
      <Modal open={!!closing} onClose={() => setClosing(null)} title="Encerrar reserva simulada">
        <p>
          Informe o consumo fictício. O restante volta ao saldo disponível. Esta ação não apura
          presença nem remuneração dos entregadores.
        </p>
        {closing && (
          <Form
            key={closing.id}
            fields={[
              {
                name: 'consumedCents',
                label: 'Consumo fictício (R$)',
                kind: 'money',
                min: 0,
                max: Number(closing.amountCents) / 100,
              },
              reasons,
            ]}
            onSubmit={(b) =>
              run(`/finance/reservations/${closing.id}/close`, {
                ...b,
                consumedCents: String(b.consumedCents),
              })
            }
            submitLabel="Confirmar encerramento simulado"
          />
        )}
      </Modal>
    </div>
  );
}
function Pager({
  cursor,
  next,
  set,
}: {
  cursor: string;
  next: string | null | undefined;
  set: (v: string) => void;
}) {
  return (
    <div className="actions">
      {cursor && (
        <Button variant="secondary" onClick={() => set('')}>
          Voltar ao início
        </Button>
      )}
      {next && (
        <Button variant="secondary" onClick={() => set(next)}>
          Próxima página
        </Button>
      )}
    </div>
  );
}
