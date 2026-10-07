import { createContext, useContext, type PropsWithChildren, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
  type RefreshControlProps,
} from 'react-native';
const light = {
  background: '#f3f6f4',
  surface: '#ffffff',
  text: '#182d25',
  muted: '#64756d',
  border: '#dbe5de',
  primary: '#166b46',
  onPrimary: '#ffffff',
  danger: '#af3440',
  tint: '#e5f4ea',
};
const dark = {
  background: '#101b16',
  surface: '#192920',
  text: '#eef6f0',
  muted: '#b0c2b5',
  border: '#344b3c',
  primary: '#82d7a5',
  onPrimary: '#12261a',
  danger: '#ffb3b9',
  tint: '#263c2d',
};
const Theme = createContext(light);
export const useTheme = () => useContext(Theme);
export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <Theme.Provider value={useColorScheme() === 'dark' ? dark : light}>{children}</Theme.Provider>
  );
}
export function Copy({
  children,
  title = false,
  muted = false,
}: PropsWithChildren<{ title?: boolean; muted?: boolean }>) {
  const t = useTheme();
  return (
    <Text
      style={{
        color: muted ? t.muted : t.text,
        fontSize: title ? 23 : 16,
        fontWeight: title ? '700' : '400',
        lineHeight: title ? 30 : 24,
      }}
    >
      {children}
    </Text>
  );
}
export function Card({ children }: PropsWithChildren) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? t.tint : t.primary,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: secondary ? t.text : t.onPrimary,
          fontSize: 16,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.gap}>
      <Text style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        style={[
          styles.input,
          { color: t.text, backgroundColor: t.surface, borderColor: t.border },
          props.style,
        ]}
      />
    </View>
  );
}
export function Screen({
  children,
  refreshControl,
}: PropsWithChildren<{ refreshControl?: ReactElement<RefreshControlProps> }>) {
  const t = useTheme();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={styles.screen}
    >
      {children}
    </ScrollView>
  );
}
export function Loading() {
  const t = useTheme();
  return <ActivityIndicator accessibilityLabel="Carregando" color={t.primary} size="large" />;
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  const t = useTheme();
  return (
    <View accessibilityRole="alert" style={styles.gap}>
      <Text style={{ color: t.danger, fontSize: 16, lineHeight: 23 }}>{message}</Text>
      {retry && <Button secondary title="Tentar novamente" onPress={retry} />}
    </View>
  );
}
export function Empty({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <Copy title>{title}</Copy>
      <Copy muted>{description}</Copy>
    </Card>
  );
}
export const styles = StyleSheet.create({
  screen: { padding: 20, gap: 18, paddingBottom: 30 },
  card: { padding: 20, borderRadius: 22, borderWidth: 1, gap: 14 },
  button: {
    minHeight: 52,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  gap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
});
