import { useState } from 'react';
import { Linking, ScrollView, View, useWindowDimensions } from 'react-native';
import type { Delivery } from '@solution/contracts';
import { dateTime, formatAddress, money, stageLabels } from '@solution/contracts';
import { nextStep } from '../core/delivery';
import { navigationLink, navigationTarget } from '../core/navigation';
import { Button, Copy, ErrorNotice, useTheme } from './ui';
export function DeliveryPanel({
  delivery,
  pending,
  error,
  onStep,
  onDismiss,
  onHeight,
}: {
  delivery: Delivery;
  pending: boolean;
  error?: string | null;
  onStep: (step: NonNullable<(typeof nextStep)[Delivery['status']]>) => void;
  onDismiss: () => void;
  onHeight: (height: number) => void;
}) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const target = navigationTarget(delivery);
  const step = nextStep[delivery.status];
  async function open(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError('Não foi possível abrir o aplicativo de navegação.');
    }
  }
  return (
    <View
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: theme.surface,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 12,
        gap: 8,
        maxHeight: height * 0.46,
      }}
    >
      <ScrollView contentContainerStyle={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Copy>
              #{delivery.code} · {stageLabels[delivery.status]}
            </Copy>
          </View>
          <Copy>{money(delivery.courierPayoutCents)}</Copy>
        </View>
        {target ? (
          <>
            <Copy>
              {target.leg === 'pickup' ? 'Coleta' : 'Entrega'} · {target.label}
            </Copy>
            <Copy muted>{formatAddress(target.address)}</Copy>
          </>
        ) : (
          <Copy>Entrega finalizada. Você está pronto para a próxima oferta.</Copy>
        )}
        {expanded && (
          <>
            <Copy>Destinatário: {delivery.recipientName}</Copy>
            <Button
              title="Ligar para o destinatário"
              secondary
              onPress={() => void open(`tel:${delivery.recipientPhone.replace(/[^\d+]/g, '')}`)}
            />
            {!!delivery.notes && <Copy>{delivery.notes}</Copy>}
            <Copy>Etapas da entrega</Copy>
            {(['accepted', 'arrived', 'collected', 'delivered'] as const).map((status) => {
              const event = delivery.events?.find((e) => e.newStatus === status);
              const done =
                ['accepted', 'arrived', 'collected', 'delivered'].indexOf(status) <=
                ['accepted', 'arrived', 'collected', 'delivered'].indexOf(delivery.status);
              return (
                <Copy key={status}>
                  {done ? '✓' : '○'} {stageLabels[status]}
                  {event ? ` · ${dateTime(event.createdAt)}` : ''}
                </Copy>
              );
            })}
          </>
        )}
        {(error || linkError) && <ErrorNotice message={error || linkError!} />}
      </ScrollView>
      {step ? (
        <Button title={step.label} disabled={pending} onPress={() => onStep(step)} />
      ) : (
        <Button title="Voltar a receber ofertas" onPress={onDismiss} />
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {target && (
          <View style={{ flex: 1 }}>
            <Button
              title="Abrir navegação"
              secondary
              onPress={() => {
                const url = navigationLink(delivery);
                if (url) void open(url);
              }}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Button
            title={expanded ? 'Recolher detalhes' : 'Ver detalhes'}
            secondary
            onPress={() => setExpanded((value) => !value)}
          />
        </View>
      </View>
    </View>
  );
}
