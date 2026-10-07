import { useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Card, Copy } from './ui';
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const picker = (
    <DateTimePicker
      value={new Date(`${value}T12:00:00`)}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      onChange={(event, date) => {
        if (Platform.OS === 'android') setOpen(false);
        if (event.type === 'set' && date)
          onChange(
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          );
      }}
    />
  );
  return (
    <View style={{ gap: 8 }}>
      <Copy>{label}</Copy>
      <Button
        title={value.split('-').reverse().join('/')}
        secondary
        onPress={() => setOpen(true)}
      />
      {open &&
        (Platform.OS === 'ios' ? (
          <Modal transparent animationType="slide" onRequestClose={() => setOpen(false)}>
            <View
              style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0009' }}
            >
              <Card>
                <Copy title>{label}</Copy>
                {picker}
                <Button title="Usar data" onPress={() => setOpen(false)} />
              </Card>
            </View>
          </Modal>
        ) : (
          picker
        ))}
    </View>
  );
}
