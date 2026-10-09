import { useState } from 'react';
import type { ExternalOrder, Page, User } from '@solution/contracts';
import { dateTime, externalProviderLabels, formatAddress } from '@solution/contracts';
import { Button, Card, Empty, ErrorState, Loading, Modal, Pagination, Status } from '@solution/ui';
import { useData, useAction } from '../lib/query';
import { Form } from '../components/Form';
import { CreateDelivery } from '../components/CreateDelivery';
import { DeliveryDetails, DeliveryStatus } from '../components/Delivery';
export function ExternalOrders({ user }: { user: User }) {
  const [page, setPage] = useState(1);
  const [simulate, setSimulate] = useState(false);
  const [selected, setSelected] = useState<ExternalOrder | null>(null);
  const [delivery, setDelivery] = useState<string | null>(null);
  const [reference, setReference] = useState(() => `DEMO-${crypto.randomUUID().slice(0, 8)}`);
  const query = useData<Page<ExternalOrder>>(`/external-orders?page=${page}&pageSize=20`);
  const action = useAction();
  return (
    <div className="stack page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CANAIS DE PEDIDOS</p>
          <h1>Pedidos externos</h1>
          <p className="muted">Receba, revise e acompanhe as entregas de cada canal.</p>
        </div>
        <Button onClick={() => setSimulate(true)}>Simular pedido</Button>
      </div>
      <Card>
        <Status tone="neutral">Modo demonstrativo</Status>
        <p>
          iFood e 99Food são origens simuladas. Nenhuma conta está conectada e nenhum pedido é
          recebido ou enviado às plataformas reais.
        </p>
        <p className="muted">
          A simulação usa dados fictícios. Confira o endereço e o frete antes de criar a entrega.
        </p>
      </Card>
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState message={query.error.message} retry={() => void query.refetch()} />
      ) : !query.data?.items.length ? (
        <Empty
          title="Nenhum pedido recebido"
          description="Simule um pedido para apresentar a operação integrada."
        />
      ) : (
        <ul className="directory-grid" aria-label="Pedidos externos recebidos">
          {query.data.items.map((order) => (
            <li key={order.id} className="directory-card">
              <div className="directory-identity">
                <small>{externalProviderLabels[order.provider]} · Demonstração</small>
                <h2>{order.externalReference}</h2>
                <p>{order.establishment.name}</p>
                <p className="muted">{dateTime(order.createdAt)}</p>
              </div>
              <div>
                <strong>{order.recipientName}</strong>
                <p className="muted">{formatAddress(order.destinationAddress)}</p>
              </div>
              {order.delivery ? (
                <>
                  <DeliveryStatus status={order.delivery.status} />
                  <Button variant="secondary" onClick={() => setDelivery(order.delivery!.id)}>
                    Ver entrega #{order.delivery.code}
                  </Button>
                </>
              ) : (
                <>
                  <Status tone="neutral">Aguardando revisão</Status>
                  <Button onClick={() => setSelected(order)}>Revisar e criar entrega</Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {query.data && <Pagination {...query.data} onChange={setPage} />}
      {simulate && (
        <Modal
          title="Simular pedido externo"
          description="Demonstração sem conexão com serviços oficiais. Repetir loja, origem e referência recupera o mesmo pedido."
          open
          onClose={() => setSimulate(false)}
        >
          <Form
            draftKey="external-orders:simulate"
            fields={[
              {
                name: 'establishmentId',
                label: 'Estabelecimento',
                kind: 'select',
                source: '/establishments?lifecycleStatus=active&operationOpen=true',
                default: user.establishmentId ?? '',
                full: true,
              },
              {
                name: 'provider',
                label: 'Origem simulada',
                kind: 'select',
                default: 'ifood',
                options: Object.entries(externalProviderLabels).map(([value, label]) => ({
                  value,
                  label,
                })),
              },
              {
                name: 'externalReference',
                label: 'Referência do pedido',
                default: reference,
                min: 1,
                max: 80,
              },
            ]}
            submitLabel="Receber pedido demonstrativo"
            busy={action.isPending}
            onSubmit={async (values) => {
              await action.mutateAsync({ path: '/external-orders/simulate', body: values });
              setReference(`DEMO-${crypto.randomUUID().slice(0, 8)}`);
              setPage(1);
              setSimulate(false);
            }}
          />
        </Modal>
      )}
      {selected && (
        <CreateDelivery
          key={selected.id}
          user={user}
          externalOrder={selected}
          onClose={() => {
            setSelected(null);
            void query.refetch();
          }}
        />
      )}
      {delivery && <DeliveryDetails id={delivery} user={user} onClose={() => setDelivery(null)} />}
    </div>
  );
}
