import { useState } from 'react';
import {
  financeMoney,
  payoutLabels,
  type FinanceEarningView,
  type FinancePage,
} from '@solution/contracts';
import { useData } from '../core/queries';
import { useForeground } from '../core/foreground';
import { Button, Card, Copy, ErrorNotice, Loading } from './ui';
export function FinanceEarnings() {
  const [cursor, setCursor] = useState('');
  const foreground = useForeground();
  const data = useData<FinancePage<FinanceEarningView>>(
    '/finance/earnings' + (cursor ? `?cursor=${cursor}` : ''),
    foreground,
    20000,
  );
  return (
    <Card>
      <Copy title>Ganhos e repasses simulados</Copy>
      <Copy>Valores apurados no fechamento semanal. Não representam pagamentos bancários.</Copy>
      {data.isLoading && <Loading />}
      {data.error && <ErrorNotice message={data.error.message} retry={() => void data.refetch()} />}
      {data.data?.items.length === 0 && <Copy>Nenhum ganho apurado.</Copy>}
      {data.data?.items.map((e) => (
        <Card key={e.id}>
          <Copy title>{financeMoney(e.amountCents)}</Copy>
          <Copy>
            {e.snapshot.attendedMinutes} min de presença · {e.snapshot.deliveries} entregas
          </Copy>
          <Copy>Complemento de garantia: {financeMoney(e.snapshot.supplement)}</Copy>
          <Copy>
            {e.payouts.find((p) => ['pending', 'unknown', 'paid'].includes(p.status))
              ? payoutLabels[
                  e.payouts.find((p) => ['pending', 'unknown', 'paid'].includes(p.status))!.status
                ]
              : 'Devido no simulador'}
          </Copy>
        </Card>
      ))}
      {cursor && <Button title="Voltar ao início" onPress={() => setCursor('')} />}
      {data.data?.nextCursor && (
        <Button title="Mais ganhos" onPress={() => setCursor(data.data!.nextCursor!)} />
      )}
    </Card>
  );
}
