import { Modal, View } from 'react-native';
import { Button, Card, Copy, ErrorNotice, useTheme } from './ui';
export function Confirm({
  title,
  description,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onClose();
      }}
    >
      <View
        style={{ flex: 1, backgroundColor: '#0009', padding: 24, justifyContent: 'center' }}
        accessibilityViewIsModal
      >
        <View style={{ backgroundColor: t.surface, borderRadius: 22 }}>
          <Card>
            <Copy title>{title}</Copy>
            <Copy>{description}</Copy>
            {error && <ErrorNotice message={error} />}
            <Button
              title={pending ? 'Confirmando…' : 'Confirmar'}
              disabled={pending}
              onPress={onConfirm}
            />
            <Button title="Voltar" secondary disabled={pending} onPress={onClose} />
          </Card>
        </View>
      </View>
    </Modal>
  );
}
