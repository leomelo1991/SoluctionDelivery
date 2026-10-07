import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSession } from '../core/session';
import { Button, Card, Copy, ErrorNotice, Field, Screen } from '../components/ui';
import { useMobileDraft } from '../core/drafts';
export function Access() {
  const { login } = useSession();
  const [tenant, setTenant] = useMobileDraft('tenant');
  const [email, setEmail] = useMobileDraft('email');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setError(null);
    if (!tenant.trim() || !email.trim() || !password) {
      setError('Informe a empresa, seu e-mail e a senha.');
      return;
    }
    setPending(true);
    try {
      await login(tenant, email, password);
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setPending(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Copy muted>SOLUTION DELIVERY · ENTREGADOR</Copy>
        <Copy title>Sua próxima entrega começa aqui.</Copy>
        <Copy muted>Entre com o acesso fornecido pela sua empresa de logística.</Copy>
        <Card>
          <Field
            label="Empresa"
            value={tenant}
            onChangeText={setTenant}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!pending}
          />
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!pending}
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            editable={!pending}
            onSubmitEditing={() => void submit()}
          />
          {error && <ErrorNotice message={error} />}
          <Button
            title={pending ? 'Entrando…' : 'Entrar'}
            disabled={pending}
            onPress={() => void submit()}
          />
        </Card>
        <Copy muted>
          Precisa de acesso ou esqueceu a senha? Fale com o administrador da sua empresa.
        </Copy>
      </Screen>
    </KeyboardAvoidingView>
  );
}
export function FirstPassword() {
  const { client, refreshUser, logout } = useSession();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setError(null);
    if (password.length < 12 || password !== confirmation) {
      setError('Use pelo menos 12 caracteres e confirme a mesma senha.');
      return;
    }
    setPending(true);
    try {
      await client.request('/auth/password', 'POST', {
        currentPassword: current,
        newPassword: password,
      });
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível trocar a senha.');
    } finally {
      setPending(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Copy title>Defina sua senha pessoal</Copy>
        <Copy muted>Troque a senha inicial antes de receber entregas.</Copy>
        <Card>
          <Field
            label="Senha inicial"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoCapitalize="none"
            editable={!pending}
          />
          <Field
            label="Nova senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!pending}
          />
          <Field
            label="Confirmar nova senha"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoCapitalize="none"
            editable={!pending}
          />
          {error && <ErrorNotice message={error} />}
          <Button
            title={pending ? 'Alterando…' : 'Alterar senha e continuar'}
            disabled={pending}
            onPress={() => void submit()}
          />
          <Button
            title="Sair da conta"
            secondary
            disabled={pending}
            onPress={() => void logout().catch((e) => setError(e.message))}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
