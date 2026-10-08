import { useState } from 'react';
import type {
  CommercialContract,
  CommercialVersion,
  CommercialTemplate,
  CommercialBudget,
  CommercialShift,
  CommercialAllocation,
  Page,
  User,
} from '@solution/contracts';
import { dateTime, money } from '@solution/contracts';
import { Button, Card, Empty, ErrorState, Loading, Modal, Status } from '@solution/ui';
import { Form, type FormField, type Values } from '../components/Form';
import { useAction, useData } from '../lib/query';
import { api } from '../lib/api';
import { useDraftState, useDraftKey, clearDraft } from '../lib/drafts';
const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const time = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const minutes = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
};
function local(value: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(value))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
const instant = (v: unknown) => new Date(String(v) + ':00-03:00').toISOString();
const statusLabel = { draft: 'Rascunho', proposed: 'Aguardando aceite', accepted: 'Aceito' };
const moneyField = (name: string, label: string, max = 1000000): FormField => ({
  name,
  label,
  kind: 'money',
  default: 0,
  max,
});
function Budget({ value }: { value: CommercialBudget }) {
  return (
    <dl className="contract-summary">
      <div>
        <dt>Entregas previstas/semana</dt>
        <dd>{value.deliveries}</dd>
      </div>
      <div>
        <dt>Horas-entregador/semana</dt>
        <dd>{(value.courierMinutes / 60).toLocaleString('pt-BR')}</dd>
      </div>
      <div>
        <dt>Orçamento semanal da loja</dt>
        <dd>{money(value.merchantCents)}</dd>
      </div>
      {value.estimatedCourierCents !== undefined && (
        <>
          <div>
            <dt>Remuneração estimada</dt>
            <dd>{money(value.estimatedCourierCents)}</dd>
          </div>
          <div>
            <dt>Margem bruta estimada</dt>
            <dd>{money(value.grossMarginCents ?? 0)}</dd>
          </div>
        </>
      )}
    </dl>
  );
}
function Editor({
  contract,
  version,
  onClose,
}: {
  contract?: CommercialContract;
  version?: CommercialVersion;
  onClose: () => void;
}) {
  const action = useAction();
  const key = `contracts-editor:${contract?.id ?? 'new'}:${version?.id ?? 'new'}`;
  const storageKey = useDraftKey(key);
  const [templates, setTemplates] = useDraftState<CommercialTemplate[]>(
    key + ':templates',
    version?.terms.templates ?? [
      { weekday: 1, startMinute: 1080, endMinute: 1380, courierCount: 2, expectedDeliveries: 20 },
    ],
  );
  const [preview, setPreview] = useState<{ budget: CommercialBudget; body: object } | null>(null);
  const terms = version?.terms;
  const fields: FormField[] = [
    ...(!contract
      ? [
          { name: 'title', label: 'Nome do contrato', min: 2, max: 120 },
          {
            name: 'establishmentId',
            label: 'Estabelecimento',
            kind: 'select' as const,
            source: '/establishments',
          },
        ]
      : []),
    { name: 'effectiveFrom', label: 'Vigência: início (São Paulo)', kind: 'datetime-local' },
    { name: 'effectiveTo', label: 'Vigência: fim exclusivo (São Paulo)', kind: 'datetime-local' },
    { name: 'coverage', label: 'Área de atendimento', min: 2, max: 1000 },
    {
      name: 'servicePolicy',
      label: 'Condições de presença, faltas, substituição e cancelamento',
      kind: 'textarea',
      min: 10,
      max: 4000,
      full: true,
    },
    moneyField('weeklyAvailabilityCents', 'Disponibilidade mínima semanal (R$)'),
    moneyField('platformFeeCents', 'Taxa semanal da plataforma, se não incluída (R$)'),
    moneyField('deliveryFeeCents', 'Parcela variável por entrega (R$)', 1000),
    {
      name: 'payModel',
      label: 'Remuneração dos entregadores',
      kind: 'select',
      default: 'fixed',
      options: [
        { value: 'per_delivery', label: 'Por entrega' },
        { value: 'fixed', label: 'Fixo por turno' },
        { value: 'fixed_plus_delivery', label: 'Fixo + entregas' },
        { value: 'guarantee', label: 'Garantia mínima (complementa os ganhos)' },
      ],
    },
    moneyField('courierFixedCents', 'Fixo ou garantia por entregador/turno (R$)', 100000),
    moneyField('courierDeliveryCents', 'Parcela por entrega do entregador (R$)', 1000),
  ];
  const initial = {
    ...terms,
    ...(version
      ? { effectiveFrom: local(version.effectiveFrom), effectiveTo: local(version.effectiveTo) }
      : {}),
  };
  const patch = (i: number, field: keyof CommercialTemplate, value: number) => {
    setPreview(null);
    setTemplates(templates.map((t, j) => (j === i ? { ...t, [field]: value } : t)));
  };
  return (
    <Modal
      open
      title={
        contract
          ? version?.status === 'draft'
            ? 'Editar rascunho'
            : 'Nova versão do contrato'
          : 'Novo contrato'
      }
      onClose={onClose}
    >
      <p>
        Modelo semanal: mínimo de disponibilidade + entregas realizadas. Valores previstos; a
        apuração financeira será habilitada em etapa posterior.
      </p>
      <Form
        draftKey={key}
        clearDraftOnSubmit={false}
        fields={fields}
        initial={initial}
        onDirty={() => setPreview(null)}
        submitLabel="Calcular orçamento"
        onSubmit={async (values) => {
          const { effectiveFrom, effectiveTo, title, establishmentId, ...pricing } = values;
          const body = {
            effectiveFrom: instant(effectiveFrom),
            effectiveTo: instant(effectiveTo),
            terms: { ...pricing, timezone: 'America/Sao_Paulo', templates },
            ...(!contract ? { title, establishmentId } : {}),
          };
          const budget = await api<CommercialBudget>('/contracts/simulate', 'POST', body.terms);
          setPreview({ budget, body });
        }}
      >
        <fieldset className="contract-templates">
          <legend>Turnos semanais — horário de São Paulo</legend>
          {templates.map((t, i) => (
            <div className="contract-template" key={i}>
              <label>
                Dia
                <select
                  aria-label={`Dia do turno ${i + 1}`}
                  value={t.weekday}
                  onChange={(e) => patch(i, 'weekday', Number(e.target.value))}
                >
                  {days.map((d, j) => (
                    <option key={j} value={j}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Início
                <input
                  aria-label={`Início do turno ${i + 1}`}
                  type="time"
                  required
                  value={time(t.startMinute)}
                  onChange={(e) => patch(i, 'startMinute', minutes(e.target.value))}
                />
              </label>
              <label>
                Fim
                <input
                  aria-label={`Fim do turno ${i + 1}`}
                  type="time"
                  required
                  value={time(t.endMinute)}
                  onChange={(e) => patch(i, 'endMinute', minutes(e.target.value))}
                />
              </label>
              <label>
                Entregadores simultâneos
                <input
                  aria-label={`Entregadores do turno ${i + 1}`}
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={t.courierCount}
                  onChange={(e) => patch(i, 'courierCount', Number(e.target.value))}
                />
              </label>
              <label>
                Entregas previstas
                <input
                  aria-label={`Volume do turno ${i + 1}`}
                  type="number"
                  min={0}
                  max={10000}
                  required
                  value={t.expectedDeliveries}
                  onChange={(e) => patch(i, 'expectedDeliveries', Number(e.target.value))}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                disabled={templates.length === 1}
                onClick={() => {
                  setTemplates(templates.filter((_, j) => i !== j));
                  setPreview(null);
                }}
              >
                Remover turno {i + 1}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={templates.length >= 21}
            onClick={() => {
              setTemplates([
                ...templates,
                {
                  weekday: 2,
                  startMinute: 1080,
                  endMinute: 1380,
                  courierCount: 1,
                  expectedDeliveries: 10,
                },
              ]);
              setPreview(null);
            }}
          >
            Adicionar turno
          </Button>
          <p>
            Fim anterior ou igual ao início indica término no dia seguinte. Para escala maior no
            mesmo horário, aumente a quantidade de entregadores.
          </p>
        </fieldset>
      </Form>
      {preview && (
        <Card>
          <Budget value={preview.budget} />
          <p>
            Remuneração simulada com volume distribuído entre os entregadores. A margem não deduz
            taxas e outros custos.
          </p>
          <Button
            disabled={action.isPending}
            onClick={async () => {
              const editing = version?.status === 'draft';
              try {
                await action.mutateAsync({
                  path: !contract
                    ? '/contracts'
                    : editing
                      ? `/contract-versions/${version.id}`
                      : `/contracts/${contract.id}/versions`,
                  method: editing ? 'PATCH' : 'POST',
                  body: { ...preview.body, ...(editing ? { revision: version.revision } : {}) },
                });
                if (storageKey) clearDraft(storageKey);
                onClose();
              } catch {
                /* useAction displays the error and preserves the draft. */
              }
            }}
          >
            Salvar rascunho calculado
          </Button>
        </Card>
      )}
    </Modal>
  );
}
export function ContractsPage({ user }: { user: User }) {
  const admin = user.role === 'admin';
  const [tab, setTab] = useState<'contracts' | 'shifts'>('contracts');
  const [page, setPage] = useState(1);
  const [shiftPage, setShiftPage] = useState(1);
  const contracts = useData<Page<CommercialContract>>(`/contracts?page=${page}&pageSize=10`);
  const shifts = useData<Page<CommercialShift>>(`/contract-shifts?page=${shiftPage}&pageSize=15`);
  const action = useAction();
  const [editor, setEditor] = useState<{
    contract?: CommercialContract;
    version?: CommercialVersion;
  } | null>(null);
  const [task, setTask] = useState<{
    title: string;
    path: string;
    fields: FormField[];
    initial?: Values;
    body?: (v: Values) => object;
  } | null>(null);
  const reason: FormField = {
    name: 'reason',
    label: 'Justificativa / referência',
    min: 10,
    max: 1000,
    kind: 'textarea',
  };
  const cancel = (title: string, path: string) => setTask({ title, path, fields: [reason] });
  const allocate = (s: CommercialShift) =>
    setTask({
      title: 'Alocar entregador',
      path: `/contract-shifts/${s.id}/allocate`,
      fields: [
        { name: 'courierId', label: 'Entregador aprovado', kind: 'select', source: '/couriers' },
        { name: 'position', label: 'Vaga do turno', kind: 'number', min: 1, max: s.capacity },
        { name: 'startsAt', label: 'Início da alocação (São Paulo)', kind: 'datetime-local' },
        { name: 'endsAt', label: 'Fim da alocação (São Paulo)', kind: 'datetime-local' },
      ],
      initial: { position: 1, startsAt: local(s.startsAt), endsAt: local(s.endsAt) },
      body: (v) => ({ ...v, startsAt: instant(v.startsAt), endsAt: instant(v.endsAt) }),
    });
  const attendance = (a: CommercialAllocation) =>
    setTask({
      title: 'Registrar presença após o intervalo',
      path: `/contract-allocations/${a.id}/attendance`,
      fields: [
        {
          name: 'attendedMinutes',
          label: 'Minutos de disponibilidade prestada (zero para falta)',
          kind: 'number',
          min: 0,
          max: Math.floor((Date.parse(a.endsAt) - Date.parse(a.startsAt)) / 60000),
        },
        reason,
      ],
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CAPACIDADE E CONDIÇÕES COMERCIAIS</p>
          <h1>Contratos e escala</h1>
          <p>Combine a quantidade de entregadores, os turnos e o preço da operação.</p>
        </div>
        {admin && <Button onClick={() => setEditor({})}>Novo contrato</Button>}
      </div>
      <p className="muted">
        Nesta etapa, contratos e orçamentos organizam o planejamento. As tarifas das entregas
        continuam nas condições atuais; cobrança e pagamento automáticos ainda não estão
        habilitados.
      </p>
      <div className="actions">
        <Button
          variant={tab === 'contracts' ? 'primary' : 'secondary'}
          onClick={() => setTab('contracts')}
        >
          Contratos
        </Button>
        <Button
          variant={tab === 'shifts' ? 'primary' : 'secondary'}
          onClick={() => setTab('shifts')}
        >
          Escala e presença
        </Button>
      </div>
      {tab === 'contracts' && (
        <>
          {contracts.isLoading && <Loading />}
          {contracts.error && (
            <ErrorState message={contracts.error.message} retry={() => void contracts.refetch()} />
          )}
          {contracts.data?.items.length === 0 && (
            <Empty
              title="Nenhum contrato cadastrado"
              description="O gestor pode criar um orçamento e enviar a proposta para aceite."
            />
          )}
          {contracts.data?.items.map((c) => (
            <Card key={c.id} className="commercial-card">
              <h2>{c.title}</h2>
              <p>{c.establishment.name}</p>
              {c.versions.length === 0 && <p>Proposta em preparação pelo gestor.</p>}
              {c.versions.map((v) => (
                <details key={v.id} open={c.versions[0].id === v.id}>
                  <summary>
                    Versão {v.number} · {statusLabel[v.status]}
                  </summary>
                  <p>
                    {dateTime(v.effectiveFrom)} até {dateTime(v.effectiveTo)} (fim exclusivo)
                  </p>
                  <Budget value={v.budget} />
                  <p>
                    <strong>Disponibilidade:</strong> {money(v.terms.weeklyAvailabilityCents)} /
                    semana · <strong>Taxa da plataforma:</strong> {money(v.terms.platformFeeCents)}{' '}
                    / semana · <strong>Por entrega:</strong> {money(v.terms.deliveryFeeCents)}
                  </p>
                  <p>
                    <strong>Área:</strong> {v.terms.coverage}
                  </p>
                  <p className="contract-policy">{v.terms.servicePolicy}</p>
                  <ul>
                    {v.terms.templates.map((t, i) => (
                      <li key={i}>
                        {days[t.weekday]} · {time(t.startMinute)}–{time(t.endMinute)}
                        {t.endMinute <= t.startMinute ? ' (dia seguinte)' : ''} · {t.courierCount}{' '}
                        entregador(es) simultâneos · {t.expectedDeliveries} entregas previstas
                      </li>
                    ))}
                  </ul>
                  {v.acceptedAt && (
                    <p>
                      Aceite registrado em {dateTime(v.acceptedAt)}: {v.acceptanceEvidence}
                    </p>
                  )}
                  <div className="actions">
                    {admin && (
                      <Button
                        variant="secondary"
                        onClick={() => setEditor({ contract: c, version: v })}
                      >
                        {v.status === 'draft' ? 'Editar rascunho' : 'Criar nova versão'}
                      </Button>
                    )}
                    {admin && v.status === 'draft' && (
                      <Button
                        disabled={action.isPending}
                        onClick={() =>
                          void action
                            .mutateAsync({
                              path: `/contract-versions/${v.id}/propose`,
                              body: { revision: v.revision },
                            })
                            .catch(() => {})
                        }
                      >
                        Enviar proposta e fixar condições
                      </Button>
                    )}
                    {v.status === 'proposed' && (
                      <Button
                        onClick={() =>
                          setTask({
                            title: admin
                              ? 'Registrar aceite externo da loja'
                              : 'Aceitar as condições da proposta',
                            path: `/contract-versions/${v.id}/accept`,
                            fields: [
                              {
                                name: 'evidence',
                                label: admin
                                  ? 'Referência do aceite recebido da loja'
                                  : 'Declaração de aceite das condições acima',
                                min: 10,
                                max: 1000,
                                kind: 'textarea',
                              },
                            ],
                            body: (values) => ({ ...values, revision: v.revision }),
                          })
                        }
                      >
                        {admin ? 'Registrar aceite da loja' : 'Aceitar proposta'}
                      </Button>
                    )}
                    {admin && v.status === 'accepted' && (
                      <Button
                        onClick={() =>
                          setTask({
                            title: 'Agendar ocorrência do turno',
                            path: '/contract-shifts',
                            fields: [
                              {
                                name: 'templateIndex',
                                label: 'Turno do contrato',
                                kind: 'select',
                                options: v.terms.templates.map((t, i) => ({
                                  value: String(i),
                                  label: `${days[t.weekday]} ${time(t.startMinute)}–${time(t.endMinute)} · ${t.courierCount} vagas`,
                                })),
                              },
                              {
                                name: 'startsAt',
                                label: 'Data e hora de início (São Paulo)',
                                kind: 'datetime-local',
                              },
                            ],
                            body: (values) => ({
                              versionId: v.id,
                              templateIndex: Number(values.templateIndex),
                              startsAt: instant(values.startsAt),
                            }),
                          })
                        }
                      >
                        Agendar turno
                      </Button>
                    )}
                  </div>
                </details>
              ))}
            </Card>
          ))}
          <div className="actions">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span>Página {page}</span>
            <Button
              variant="ghost"
              disabled={!contracts.data || page * 10 >= contracts.data.total}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      )}
      {tab === 'shifts' && (
        <>
          {shifts.isLoading && <Loading />}
          {shifts.error && (
            <ErrorState message={shifts.error.message} retry={() => void shifts.refetch()} />
          )}
          {shifts.data?.items.length === 0 && (
            <Empty
              title="Nenhum turno agendado"
              description="Depois do aceite, o gestor pode agendar ocorrências e reservar os entregadores."
            />
          )}
          {shifts.data?.items.map((s) => (
            <Card key={s.id} className="commercial-card">
              <h2>{s.version.contract.establishment.name}</h2>
              <Status>{s.status === 'cancelled' ? 'Cancelado' : 'Agendado'}</Status>
              <p>
                {dateTime(s.startsAt)} — {dateTime(s.endsAt)} · {s.capacity} vaga(s) · versão{' '}
                {s.version.number}
              </p>
              <p>
                Capacidade contratada:{' '}
                {(
                  (s.capacity * (Date.parse(s.endsAt) - Date.parse(s.startsAt))) /
                  3600000
                ).toLocaleString('pt-BR')}{' '}
                horas-entregador. Alocadas:{' '}
                {(
                  s.allocations
                    .filter((a) => !a.cancelledAt)
                    .reduce((sum, a) => sum + Date.parse(a.endsAt) - Date.parse(a.startsAt), 0) /
                  3600000
                ).toLocaleString('pt-BR')}{' '}
                horas-entregador.
              </p>
              {s.allocations.map((a) => (
                <div key={a.id} className="contract-allocation">
                  <strong>
                    Vaga {a.position} · {a.courier.name}
                    {a.cancelledAt ? ' · Liberada' : ''}
                  </strong>
                  <p>
                    {dateTime(a.startsAt)} — {dateTime(a.endsAt)}
                  </p>
                  {a.attendance[0] && (
                    <p>
                      Último registro: {a.attendance[0].attendedMinutes} minutos prestados ·{' '}
                      {a.attendance[0].reason}
                    </p>
                  )}
                  {a.attendance.length > 1 && (
                    <details>
                      <summary>Histórico de presença</summary>
                      {a.attendance.map((e) => (
                        <p key={e.id}>
                          {dateTime(e.createdAt)} · {e.attendedMinutes} minutos · {e.reason}
                        </p>
                      ))}
                    </details>
                  )}
                  {admin && !a.cancelledAt && (
                    <div className="actions">
                      {Date.parse(a.endsAt) > Date.now() && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setTask({
                              title: 'Substituir entregador',
                              path: `/contract-allocations/${a.id}/replace`,
                              fields: [
                                {
                                  name: 'courierId',
                                  label: 'Entregador substituto aprovado',
                                  kind: 'select',
                                  source: '/couriers',
                                },
                                reason,
                              ],
                            })
                          }
                        >
                          Substituir
                        </Button>
                      )}
                      {Date.parse(a.startsAt) > Date.now() && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            cancel(
                              'Liberar alocação para substituição',
                              `/contract-allocations/${a.id}/cancel`,
                            )
                          }
                        >
                          Liberar vaga
                        </Button>
                      )}
                      {Date.parse(a.endsAt) <= Date.now() && (
                        <Button variant="secondary" onClick={() => attendance(a)}>
                          Registrar presença
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {admin && s.status === 'scheduled' && (
                <div className="actions">
                  {Date.parse(s.endsAt) > Date.now() && (
                    <Button onClick={() => allocate(s)}>Alocar entregador</Button>
                  )}
                  {Date.parse(s.startsAt) > Date.now() && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        cancel('Cancelar turno futuro', `/contract-shifts/${s.id}/cancel`)
                      }
                    >
                      Cancelar turno
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
          <div className="actions">
            <Button
              variant="ghost"
              disabled={shiftPage <= 1}
              onClick={() => setShiftPage(shiftPage - 1)}
            >
              Anterior
            </Button>
            <span>Página {shiftPage}</span>
            <Button
              variant="ghost"
              disabled={!shifts.data || shiftPage * 15 >= shifts.data.total}
              onClick={() => setShiftPage(shiftPage + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      )}
      {editor && <Editor {...editor} onClose={() => setEditor(null)} />}
      {task && (
        <Modal open title={task.title} onClose={() => setTask(null)}>
          <Form
            draftKey={task.path}
            fields={task.fields}
            initial={task.initial}
            busy={action.isPending}
            onSubmit={async (values) => {
              await action.mutateAsync({
                path: task.path,
                body: task.body ? task.body(values) : values,
              });
              setTask(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}
