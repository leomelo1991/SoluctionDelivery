import { useState } from 'react';
import {
  financeMoney,
  dateTime,
  payoutLabels,
  type FinanceEarningView,
  type FinancePage,
} from '@solution/contracts';
import { Button, Card, ErrorState, Loading, Modal } from '@solution/ui';
import { useAction, useData } from '../lib/query';
import { Form } from '../components/Form';
export function FinanceEarnings({ manage = false }: { manage?: boolean }) {
  const [cursor, setCursor] = useState('');
  const [operation, setOperation] = useState<{
    path: string;
    earningId?: string;
    title: string;
  } | null>(null);
  const data = useData<FinancePage<FinanceEarningView>>(
    '/finance/earnings' + (cursor ? `?cursor=${cursor}` : ''),
  );
  const action = useAction();
  return (
    <Card>
      <h2>Ganhos e repasses simulados</h2>
      <p>
        Valores apurados após o fechamento semanal. Nenhum pagamento bancário é realizado nesta
        tela.
      </p>
      {data.isLoading && <Loading />}
      {data.error && <ErrorState message={data.error.message} retry={() => void data.refetch()} />}
      {data.data?.items.length === 0 && <p>Nenhum ganho apurado.</p>}
      {data.data?.items.map((e) => {
        const active = e.payouts.find((p) => ['pending', 'unknown', 'paid'].includes(p.status));
        return (
          <div className="finance-item" key={e.id}>
            <strong>
              {e.courierName} · {financeMoney(e.amountCents)}
            </strong>
            <small>
              {dateTime(e.createdAt)} · {e.snapshot.attendedMinutes} min de presença ·{' '}
              {e.snapshot.deliveries} entregas
            </small>
            <span>
              Fixo elegível: {financeMoney(e.snapshot.fixed)} · Variável:{' '}
              {financeMoney(e.snapshot.variable)} · Complemento de garantia:{' '}
              {financeMoney(e.snapshot.supplement)}
            </span>
            <span>{active ? payoutLabels[active.status] : 'Devido no simulador'}</span>
            {e.payouts.map((p) => (
              <small key={p.id}>
                {payoutLabels[p.status]} · {dateTime(p.createdAt)}
              </small>
            ))}
            {manage && !active && (
              <Button
                variant="secondary"
                onClick={() =>
                  setOperation({
                    path: '/finance/payouts',
                    earningId: e.id,
                    title: 'Simular repasse',
                  })
                }
              >
                Simular repasse
              </Button>
            )}
            {manage && active && ['pending', 'unknown'].includes(active.status) && (
              <Button
                variant="secondary"
                onClick={() =>
                  setOperation({
                    path: `/finance/payouts/${active.id}/process`,
                    title: 'Processar repasse simulado',
                  })
                }
              >
                Processar repasse simulado
              </Button>
            )}
            {manage && active?.status === 'paid' && (
              <Button
                variant="secondary"
                onClick={() =>
                  setOperation({
                    path: `/finance/payouts/${active.id}/return`,
                    title: 'Simular devolução',
                  })
                }
              >
                Simular devolução
              </Button>
            )}
          </div>
        );
      })}
      <div className="actions">
        {cursor && (
          <Button variant="secondary" onClick={() => setCursor('')}>
            Voltar ao início
          </Button>
        )}
        {data.data?.nextCursor && (
          <Button variant="secondary" onClick={() => setCursor(data.data!.nextCursor!)}>
            Mais ganhos
          </Button>
        )}
      </div>
      {operation && (
        <Modal open title={operation.title} onClose={() => setOperation(null)}>
          <Form
            fields={[
              ...(operation.earningId
                ? [
                    {
                      name: 'scenario',
                      kind: 'select' as const,
                      label: 'Resultado simulado',
                      options: [
                        { value: 'approve', label: 'Aprovação' },
                        { value: 'decline', label: 'Recusa' },
                        { value: 'timeout_after_accept', label: 'Confirmação incerta' },
                      ],
                    },
                  ]
                : []),
              { name: 'reason', label: 'Justificativa', min: 8, max: 500 },
            ]}
            initial={{ scenario: 'approve' }}
            busy={action.isPending}
            submitLabel="Confirmar simulação"
            onSubmit={async (b) => {
              await action.mutateAsync({
                path: operation.path,
                body: { ...b, ...(operation.earningId ? { earningId: operation.earningId } : {}) },
              });
              setOperation(null);
            }}
          />
        </Modal>
      )}
    </Card>
  );
}
