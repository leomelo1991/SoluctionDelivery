import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { MobileSession, User } from '@solution/contracts';
import { ApiClient, ApiError } from './client';
import { ErrorNotice, Loading, Screen } from '../components/ui';
const storageKey = 'solution.courier.session.v1';
interface Auth {
  user: User | null;
  client: ApiClient;
  login: (tenant: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
const Context = createContext<Auth | null>(null);
export const useSession = () => {
  const value = useContext(Context);
  if (!value) throw new Error('Sessão indisponível.');
  return value;
};
export function SessionProvider({ url, children }: PropsWithChildren<{ url: string }>) {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const clear = useCallback(() => {
    setSession(null);
    void SecureStore.deleteItemAsync(storageKey).catch(() =>
      setError('Não foi possível remover a sessão do dispositivo. Tente novamente.'),
    );
  }, []);
  const client = useMemo(
    () =>
      new ApiClient(url, {
        token: session?.accessToken,
        key: Crypto.randomUUID,
        unauthorized: clear,
      }),
    [url, session?.accessToken, clear],
  );
  useEffect(() => {
    let alive = true;
    async function restore() {
      setLoading(true);
      setError(null);
      try {
        const raw = await SecureStore.getItemAsync(storageKey);
        if (!raw) return;
        let saved: { accessToken: string; expiresAt: string };
        try {
          saved = JSON.parse(raw);
          if (
            !saved ||
            !/^[a-f0-9]{64}$/.test(saved.accessToken) ||
            !Number.isFinite(Date.parse(saved.expiresAt))
          )
            throw new Error('invalid');
        } catch {
          await SecureStore.deleteItemAsync(storageKey);
          return;
        }
        if (Date.parse(saved.expiresAt) <= Date.now()) {
          await SecureStore.deleteItemAsync(storageKey);
          return;
        }
        const user = await new ApiClient(url, { token: saved.accessToken }).request<User>('/me');
        if (user.role !== 'courier') {
          await SecureStore.deleteItemAsync(storageKey);
          return;
        }
        if (alive) setSession({ ...saved, user });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401)
          await SecureStore.deleteItemAsync(storageKey);
        else if (alive)
          setError(e instanceof Error ? e.message : 'Não foi possível restaurar o acesso.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    void restore();
    return () => {
      alive = false;
    };
  }, [url, attempt]);
  const login = async (tenant: string, email: string, password: string) => {
    const next = await new ApiClient(url).request<MobileSession>('/auth/mobile/login', 'POST', {
      tenant: tenant.trim(),
      email: email.trim(),
      password,
    });
    try {
      await SecureStore.setItemAsync(
        storageKey,
        JSON.stringify({ accessToken: next.accessToken, expiresAt: next.expiresAt }),
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
      );
    } catch {
      await new ApiClient(url, { token: next.accessToken })
        .request('/auth/logout', 'POST')
        .catch(() => undefined);
      throw new Error('Não foi possível guardar a sessão de forma segura.');
    }
    setSession(next);
  };
  const logout = async () => {
    await client.request('/auth/logout', 'POST');
    await SecureStore.deleteItemAsync(storageKey);
    setSession(null);
  };
  const refreshUser = async () => {
    const user = await client.request<User>('/me');
    setSession((s) => (s ? { ...s, user } : null));
  };
  if (loading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (error)
    return (
      <Screen>
        <ErrorNotice message={error} retry={() => setAttempt((a) => a + 1)} />
      </Screen>
    );
  return (
    <Context.Provider value={{ user: session?.user ?? null, client, login, logout, refreshUser }}>
      {children}
    </Context.Provider>
  );
}
