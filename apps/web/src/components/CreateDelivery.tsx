import { useState } from 'react';
import type { Pricing, Quote, User, ExternalOrder } from '@solution/contracts';
import { dateTime, money } from '@solution/contracts';
import { Card, Loading, Modal, Status } from '@solution/ui';
import { Form, addressFields, takeAddress, type FormField, type Values } from './Form';
import { useAction, useData } from '../lib/query';
import { api, ApiError } from '../lib/api';
export function CreateDelivery({
  user,
  onClose,
  externalOrder,
}: {
  user: User;
  onClose: () => void;
  externalOrder?: ExternalOrder;
}) {
  const pricing = useData<Pricing>('/pricing');
  const [quote, setQuote] = useState<Quote | null>(null);
  const action = useAction();
  if (!pricing.data)
    return (
      <Modal title="Nova entrega" open onClose={onClose}>
        <Loading />
      </Modal>
    );
  const fields: FormField[] = [
    {
      name: 'establishmentId',
      label: 'Estabelecimento de coleta',
      kind: 'select',
      default: user.establishmentId ?? '',
      full: true,
      source: '/establishments?lifecycleStatus=active&operationOpen=true',
    },
    { name: 'recipientName', label: 'Nome do destinatário', min: 2, max: 120 },
    { name: 'recipientPhone', label: 'Telefone do destinatário', min: 8, max: 25 },
    ...addressFields,
    {
      name: 'notes',
      label: 'Observações da entrega',
      kind: 'textarea',
      required: false,
      max: 2000,
      full: true,
    },
    {
      name: 'pickupReady',
      label: 'Pedido pronto para retirada?',
      kind: 'select',
      default: 'false',
      options: [
        { value: 'false', label: 'Ainda não informado como pronto' },
        { value: 'true', label: 'Pronto para retirada' },
      ],
    },
    {
      name: 'method',
      label: 'Modalidade do frete',
      kind: 'select',
      default: 'distance',
      options: [
        { value: 'distance', label: 'Por distância' },
        { value: 'region', label: 'Tarifa por região' },
      ],
    },
    {
      name: 'regionId',
      label: 'Região de destino (tarifa regional)',
      kind: 'select',
      required: false,
      options: [
        { value: '', label: 'Não usar tarifa regional' },
        ...pricing.data.regions
          .filter((r) => r.active)
          .map((r) => ({ value: r.id, label: `${r.name} · ${r.city} · ${money(r.feeCents)}` })),
      ],
    },
    {
      name: 'manualDistanceM',
      label: 'Distância manual em km (opcional)',
      kind: 'km',
      required: false,
      max: 2000,
    },
  ];
  async function submit(v: Values) {
    const quoteBody = {
      establishmentId: externalOrder?.establishmentId ?? v.establishmentId,
      destinationAddress: takeAddress(v),
      method: v.method,
      ...(v.method === 'region'
        ? { regionId: v.regionId }
        : v.manualDistanceM !== undefined
          ? { manualDistanceM: v.manualDistanceM }
          : {}),
    };
    if (!quote) {
      setQuote(await api<Quote>('/pricing/quotes', 'POST', quoteBody));
      return;
    }
    try {
      await action.mutateAsync({
        path: '/deliveries',
        body: {
          ...quoteBody,
          ...(externalOrder ? { externalOrderId: externalOrder.id } : {}),
          quoteId: quote.id,
          recipientName: v.recipientName,
          recipientPhone: v.recipientPhone,
          notes: v.notes,
          pickupReady: v.pickupReady === 'true',
        },
      });
      onClose();
    } catch (e) {
      if (e instanceof ApiError && ['QUOTE_EXPIRED', 'QUOTE_CHANGED'].includes(e.code))
        setQuote(null);
      throw e;
    }
  }
  return (
    <Modal
      title="Nova solicitação de entrega"
      description="Confira os endereços e escolha como calcular o frete. A coleta usa o endereço cadastrado da loja."
      open
      onClose={onClose}
    >
      <Form
        draftKey={externalOrder ? `delivery:external:${externalOrder.id}` : 'delivery:create'}
        initial={
          externalOrder
            ? {
                establishmentId: externalOrder.establishmentId,
                recipientName: externalOrder.recipientName,
                recipientPhone: externalOrder.recipientPhone,
                ...externalOrder.destinationAddress,
                notes: externalOrder.notes,
              }
            : undefined
        }
        clearDraftOnSubmit={quote !== null}
        fields={externalOrder ? fields.filter((field) => field.name !== 'establishmentId') : fields}
        onSubmit={submit}
        submitLabel={quote ? 'Confirmar e criar entrega' : 'Calcular e revisar frete'}
        busy={action.isPending}
        onDirty={() => setQuote(null)}
      >
        {externalOrder && (
          <p className="full">
            Pedido demonstrativo {externalOrder.externalReference} ·{' '}
            {externalOrder.establishment.name}. Revise o endereço de destino.
          </p>
        )}
        {quote && (
          <Card className="full quote">
            <Status tone="positive">Cotação pronta para confirmação</Status>
            <div className="quote-grid">
              <div>
                <small>Cobrança do estabelecimento</small>
                <strong>{money(quote.feeCents)}</strong>
                <span>Base: {money(quote.snapshot.baseFeeCents)}</span>
              </div>
              <div>
                <small>Remuneração do entregador</small>
                <strong>{money(quote.payoutCents)}</strong>
                <span>Base: {money(quote.snapshot.basePayoutCents)}</span>
              </div>
            </div>
            {quote.snapshot.surcharges.map((s) => (
              <p key={s.id}>
                {s.name} · {s.reason}
              </p>
            ))}
            <p className="muted">
              {quote.distanceM !== null
                ? `${(quote.distanceM / 1000).toLocaleString('pt-BR')} km · ${quote.provider === 'manual' ? 'Informação manual' : quote.provider === 'openrouteservice' ? 'openrouteservice' : quote.provider === 'google' ? 'Google Maps' : 'Mapbox'}`
                : 'Tarifa regional · distância indisponível'}
            </p>
            {quote.durationSeconds !== null && (
              <p className="muted">
                Tempo estimado de percurso: {Math.ceil(quote.durationSeconds / 60)} min
              </p>
            )}
            <p className="muted">
              Válida até {dateTime(quote.expiresAt)}. Valores previstos; não representam pagamento
              realizado.
            </p>
          </Card>
        )}
      </Form>
    </Modal>
  );
}
