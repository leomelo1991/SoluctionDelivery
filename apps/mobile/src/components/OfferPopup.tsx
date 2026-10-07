import { useEffect, useRef } from 'react';
import { Modal, ScrollView, Text, Vibration, View } from 'react-native';
import type { Offer } from '@solution/contracts';
import { formatAddress, money } from '@solution/contracts';
import { Button, Card, Copy, ErrorNotice, useTheme } from './ui';
export function OfferPopup({
  offer,
  pending,
  error,
  onAccept,
  onDecline,
}: {
  offer: Offer;
  pending: 'accept' | 'decline' | null;
  error?: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const theme = useTheme();
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (notified.current !== offer.id) {
      notified.current = offer.id;
      Vibration.vibrate(350);
    }
    return () => Vibration.cancel();
  }, [offer.id]);
  return (
    <Modal transparent animationType="slide" statusBarTranslucent onRequestClose={() => undefined}>
      <View
        style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end', padding: 18 }}
        accessibilityViewIsModal
      >
        <ScrollView
          style={{ maxHeight: '85%', borderRadius: 24, backgroundColor: theme.surface }}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 32 }} accessibilityLabel="Nova oferta de entrega">
                🏍️
              </Text>
              <View style={{ flex: 1 }}>
                <Copy title>Nova entrega para você</Copy>
                <Copy muted>
                  #{offer.code} ·{' '}
                  {offer.status === 'assigned' ? 'Direcionada para você' : 'Oferta da sua empresa'}
                </Copy>
              </View>
            </View>
            <Text style={{ fontSize: 38, fontWeight: '800', color: theme.primary }}>
              {money(offer.courierPayoutCents)}
            </Text>
            <Copy muted>Remuneração prevista</Copy>
            <View style={{ gap: 4 }}>
              <Copy>Coleta · {offer.establishment.name}</Copy>
              <Copy muted>{formatAddress(offer.pickupAddress)}</Copy>
            </View>
            <View style={{ gap: 4 }}>
              <Copy>Região de destino</Copy>
              <Copy muted>
                {offer.destinationRegion.district} · {offer.destinationRegion.city}
              </Copy>
            </View>
            <Copy muted>
              {offer.pickupReady ? 'Pedido pronto para retirada' : 'Prontidão não informada'}
              {offer.manualDistanceM !== null
                ? ` · ${(offer.manualDistanceM / 1000).toLocaleString('pt-BR')} km (manual)`
                : ''}
            </Copy>
            {error && <ErrorNotice message={error} />}
            <Button
              title={pending === 'accept' ? 'Aceitando…' : 'Aceitar entrega'}
              disabled={!!pending}
              onPress={onAccept}
            />
            <Button
              title={pending === 'decline' ? 'Recusando…' : 'Recusar oferta'}
              secondary
              disabled={!!pending}
              onPress={onDecline}
            />
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}
