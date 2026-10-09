import { useState } from 'react';
import type { Pricing, Region, Surcharge } from '@solution/contracts';
import { dateTime, money } from '@solution/contracts';
import { Button, Card, Empty, ErrorState, Loading, Modal, Status } from '@solution/ui';
import { Form, type FormField, type Values } from '../components/Form';
import { useAction, useData } from '../lib/query';
const formulaFields = (prefix: string, label: string): FormField[] => [
  { name: prefix + 'Base', label: `${label} · valor base (R$)`, kind: 'money', max: 100000 },
  { name: prefix + 'Included', label: `${label} · km incluídos`, kind: 'km', max: 2000 },
  {
    name: prefix + 'PerKm',
    label: `${label} · preço por km excedente (R$)`,
    kind: 'money',
    max: 100000,
  },
  { name: prefix + 'Minimum', label: `${label} · valor mínimo (R$)`, kind: 'money', max: 100000 },
];
const regionFields: FormField[] = [
  { name: 'name', label: 'Nome da região', min: 2, max: 100 },
  { name: 'city', label: 'Cidade', min: 2, max: 100 },
  {
    name: 'coverage',
    label: 'Descrição de cobertura',
    kind: 'textarea',
    min: 2,
    max: 1000,
    full: true,
  },
  { name: 'feeCents', label: 'Cobrança do estabelecimento (R$)', kind: 'money', max: 100000 },
  { name: 'payoutCents', label: 'Remuneração do entregador (R$)', kind: 'money', max: 100000 },
];
const surchargeFields: FormField[] = [
  { name: 'name', label: 'Nome da condição', min: 2, max: 100 },
  { name: 'reason', label: 'Motivo', min: 5, max: 500 },
  {
    name: 'feeFixedCents',
    label: 'Adicional na cobrança (R$)',
    kind: 'money',
    default: 0,
    max: 100000,
  },
  {
    name: 'feePercentBps',
    label: 'Adicional na cobrança (%)',
    kind: 'percent',
    default: 0,
    max: 1000,
  },
  {
    name: 'payoutFixedCents',
    label: 'Adicional na remuneração (R$)',
    kind: 'money',
    default: 0,
    max: 100000,
  },
  {
    name: 'payoutPercentBps',
    label: 'Adicional na remuneração (%)',
    kind: 'percent',
    default: 0,
    max: 1000,
  },
  { name: 'startsAt', label: 'Início da vigência', kind: 'datetime-local' },
  { name: 'endsAt', label: 'Fim da vigência (opcional)', kind: 'datetime-local', required: false },
];
function localDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function PricingPage() {
  const query = useData<Pricing>('/pricing');
  const action = useAction();
  const [modal, setModal] = useState<'formula' | 'region' | 'surcharge' | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [extra, setExtra] = useState<Surcharge | null>(null);
  const p = query.data;
  if (query.isLoading) return <Loading />;
  if (query.error && !p)
    return <ErrorState message={query.error.message} retry={() => void query.refetch()} />;
  if (!p) return null;
  const formulaInitial: Values = {};
  for (const side of ['fee', 'payout'] as const) {
    const f = p.formula?.[side];
    formulaInitial[side + 'Base'] = f?.baseCents ?? 0;
    formulaInitial[side + 'Included'] = f?.includedMeters ?? 0;
    formulaInitial[side + 'PerKm'] = f?.perKmCents ?? 0;
    formulaInitial[side + 'Minimum'] = f?.minimumCents ?? 0;
  }
  async function save(v: Values) {
    if (modal === 'formula') {
      const formula = (side: string) => ({
        baseCents: v[side + 'Base'],
        includedMeters: v[side + 'Included'],
        perKmCents: v[side + 'PerKm'],
        minimumCents: v[side + 'Minimum'],
      });
      await action.mutateAsync({
        path: '/pricing/formula',
        method: 'PATCH',
        body: { fee: formula('fee'), payout: formula('payout') },
      });
    }
    if (modal === 'region')
      await action.mutateAsync({
        path: '/pricing/regions' + (region ? '/' + region.id : ''),
        method: region ? 'PATCH' : 'POST',
        body: { ...v, active: region?.active ?? true },
      });
    if (modal === 'surcharge')
      await action.mutateAsync({
        path: '/pricing/surcharges' + (extra ? '/' + extra.id : ''),
        method: extra ? 'PATCH' : 'POST',
        body: {
          ...v,
          startsAt: new Date(String(v.startsAt)).toISOString(),
          ...(v.endsAt
            ? { endsAt: new Date(String(v.endsAt)).toISOString() }
            : { endsAt: undefined }),
          active: extra?.active ?? true,
        },
      });
    setModal(null);
    setRegion(null);
    setExtra(null);
  }
  return (
    <div className="stack page-stack">
      {query.error && (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      )}
      <div>
        <p className="eyebrow">REGRAS DA SUA OPERAÇÃO</p>
        <h1>Fretes e condições</h1>
        <p className="muted">Configure cobrança e remuneração de forma independente.</p>
      </div>
      <Card>
        <div className="row">
          <div>
            <h2>Preço por distância</h2>
            <p className="muted">Valor base + quilômetros excedentes, respeitando o mínimo.</p>
          </div>
          <Button variant="secondary" onClick={() => setModal('formula')}>
            {p.formula ? 'Editar fórmula' : 'Configurar fórmula'}
          </Button>
        </div>
        {p.formula ? (
          <div className="overview-grid formula-summary">
            {(['fee', 'payout'] as const).map((side) => (
              <div key={side}>
                <h3>{side === 'fee' ? 'Cobrança' : 'Remuneração'}</h3>
                <p>
                  Base {money(p.formula![side].baseCents)} ·{' '}
                  {(p.formula![side].includedMeters / 1000).toLocaleString('pt-BR')} km incluídos
                </p>
                <p>
                  {money(p.formula![side].perKmCents)} por km excedente · mínimo{' '}
                  {money(p.formula![side].minimumCents)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="note">Configure a fórmula antes de criar entregas por distância.</p>
        )}
      </Card>
      <Card>
        <div className="row">
          <div>
            <h2>Tarifas regionais</h2>
            <p className="muted">O operador seleciona a região de destino na solicitação.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setRegion(null);
              setModal('region');
            }}
          >
            Nova região
          </Button>
        </div>
        {!p.regions.length ? (
          <Empty title="Nenhuma região configurada" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Região</th>
                  <th>Cobrança</th>
                  <th>Remuneração</th>
                  <th>Disponibilidade</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.regions.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <small>
                        {r.city} · {r.coverage}
                      </small>
                    </td>
                    <td>{money(r.feeCents)}</td>
                    <td>{money(r.payoutCents)}</td>
                    <td>
                      <Status tone={r.active ? 'positive' : 'neutral'}>
                        {r.active ? 'Ativa' : 'Inativa'}
                      </Status>
                    </td>
                    <td>
                      <div className="actions">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setRegion(r);
                            setModal('region');
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={action.isPending}
                          onClick={() => {
                            if (
                              r.active &&
                              !window.confirm(
                                'Desativar esta tarifa para novas solicitações? Entregas existentes mantêm o preço.',
                              )
                            )
                              return;
                            const body = {
                              name: r.name,
                              city: r.city,
                              coverage: r.coverage,
                              feeCents: r.feeCents,
                              payoutCents: r.payoutCents,
                            };
                            void action
                              .mutateAsync({
                                path: '/pricing/regions/' + r.id,
                                method: 'PATCH',
                                body: { ...body, active: !r.active },
                              })
                              .catch(() => undefined);
                          }}
                        >
                          {r.active ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <div className="row">
          <div>
            <h2>Chuva, demanda e outros acréscimos</h2>
            <p className="muted">
              Percentuais somam sobre a base; valores fixos são adicionados depois.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setExtra(null);
              setModal('surcharge');
            }}
          >
            Novo acréscimo
          </Button>
        </div>
        <div className="stack">
          {p.surcharges.map((s) => {
            const effective =
              s.active &&
              new Date(s.startsAt) <= new Date() &&
              (!s.endsAt || new Date(s.endsAt) > new Date());
            return (
              <div className="condition" key={s.id}>
                <div className="row">
                  <h3>{s.name}</h3>
                  <Status tone={effective ? 'positive' : 'neutral'}>
                    {effective ? 'Em vigor' : s.active ? 'Fora da vigência' : 'Desativado'}
                  </Status>
                </div>
                <p>{s.reason}</p>
                <p className="muted">
                  Cobrança: {money(s.feeFixedCents)} +{' '}
                  {(s.feePercentBps / 100).toLocaleString('pt-BR')}% · Remuneração:{' '}
                  {money(s.payoutFixedCents)} + {(s.payoutPercentBps / 100).toLocaleString('pt-BR')}
                  %
                </p>
                <small>
                  {dateTime(s.startsAt)} → {s.endsAt ? dateTime(s.endsAt) : 'Sem data final'}
                </small>
                <div className="actions">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setExtra(s);
                      setModal('surcharge');
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={action.isPending}
                    onClick={() => {
                      if (
                        s.active &&
                        !window.confirm('Desativar este acréscimo para novas cotações?')
                      )
                        return;
                      const body = {
                        name: s.name,
                        reason: s.reason,
                        feeFixedCents: s.feeFixedCents,
                        feePercentBps: s.feePercentBps,
                        payoutFixedCents: s.payoutFixedCents,
                        payoutPercentBps: s.payoutPercentBps,
                        startsAt: s.startsAt,
                        ...(s.endsAt ? { endsAt: s.endsAt } : {}),
                      };
                      void action
                        .mutateAsync({
                          path: '/pricing/surcharges/' + s.id,
                          method: 'PATCH',
                          body: { ...body, active: !s.active },
                        })
                        .catch(() => undefined);
                    }}
                  >
                    {s.active ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </div>
            );
          })}
          {!p.surcharges.length && (
            <Empty
              title="Nenhum acréscimo cadastrado"
              description="Ative condições com motivo e vigência quando necessário."
            />
          )}
        </div>
      </Card>
      <Card>
        <h2>Fonte das distâncias</h2>
        {p.routing.primary === 'openrouteservice' ? (
          <p className="muted">
            As distâncias e os trajetos usam openrouteservice. Se o serviço estiver indisponível,
            use tarifa regional ou distância manual.
          </p>
        ) : (
          <>
            <p className="muted">
              Mapbox e Google Maps são usados para cotar o percurso, sem rastreamento do entregador.
            </p>
            <Form
              draftKey="pricing:routing"
              key={JSON.stringify(p.routing)}
              fields={[
                {
                  name: 'primary',
                  label: 'Provedor principal',
                  kind: 'select',
                  options: [
                    { value: 'mapbox', label: 'Mapbox' },
                    { value: 'google', label: 'Google Maps' },
                  ],
                },
                {
                  name: 'fallback',
                  label: 'Usar o outro em falhas técnicas?',
                  kind: 'select',
                  options: [
                    { value: 'true', label: 'Sim' },
                    { value: 'false', label: 'Não' },
                  ],
                },
              ]}
              initial={{ primary: p.routing.primary, fallback: String(p.routing.fallback) }}
              onSubmit={(v) =>
                action.mutateAsync({
                  path: '/pricing/routing',
                  method: 'PATCH',
                  body: { primary: v.primary, fallback: v.fallback === 'true' },
                })
              }
            />
          </>
        )}
      </Card>
      {modal && (
        <Modal
          title={
            modal === 'formula'
              ? 'Fórmula por distância'
              : modal === 'region'
                ? 'Tarifa regional'
                : 'Acréscimo operacional'
          }
          description="Alterações valem para novas cotações. Entregas já criadas preservam seus valores."
          open
          onClose={() => {
            setModal(null);
            setRegion(null);
            setExtra(null);
          }}
        >
          <Form
            draftKey={`pricing:${modal}:${region?.id ?? extra?.id ?? 'new'}`}
            fields={
              modal === 'formula'
                ? [...formulaFields('fee', 'Cobrança'), ...formulaFields('payout', 'Remuneração')]
                : modal === 'region'
                  ? regionFields
                  : surchargeFields
            }
            initial={
              modal === 'formula'
                ? formulaInitial
                : modal === 'region'
                  ? (region ?? {})
                  : {
                      ...extra,
                      startsAt: localDate(extra?.startsAt ?? new Date().toISOString()),
                      endsAt: localDate(extra?.endsAt),
                    }
            }
            onSubmit={save}
            busy={action.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
