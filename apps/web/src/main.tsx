import { Component, StrictMode, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Bike,
  Building2,
  ListChecks,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  Users as UsersIcon,
  X,
  WifiOff,
} from 'lucide-react';
import type { User } from '@solution/contracts';
import { Brand, Button, Card, Loading, ErrorState } from '@solution/ui';
import { api, ApiError, setSession } from './lib/api';
import { NoticeContext, ActorContext, actorScope } from './lib/query';
import { Form } from './components/Form';
import { clearDrafts } from './lib/drafts';
const Operations = lazy(() =>
  import('./pages/Operations').then((m) => ({ default: m.Operations })),
);
const Directory = lazy(() => import('./pages/Directory').then((m) => ({ default: m.Directory })));
const Users = lazy(() => import('./pages/Directory').then((m) => ({ default: m.Users })));
const Audit = lazy(() => import('./pages/Directory').then((m) => ({ default: m.Audit })));
const PricingPage = lazy(() => import('./pages/Pricing').then((m) => ({ default: m.PricingPage })));
const ContractsPage = lazy(() =>
  import('./pages/Contracts').then((m) => ({ default: m.ContractsPage })),
);
const CourierApp = lazy(() => import('./pages/Courier').then((m) => ({ default: m.CourierApp })));
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/latin-800.css';
import '@solution/ui/styles.css';
import './styles.css';
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 3000, retry: false }, mutations: { retry: false } },
});
async function signOut() {
  await api('/auth/logout', 'POST');
  setSession(null);
  clearDrafts();
  client.clear();
  window.location.assign('/login');
}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="login-page">
        <Card>
          <h1>Não foi possível abrir esta tela</h1>
          <p>Recarregue para recuperar os dados da operação.</p>
          <Button onClick={() => window.location.reload()}>Recarregar</Button>
        </Card>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Theme() {
  const [theme, setTheme] = useState(() => {
    try {
      const value = localStorage.getItem('sd-theme');
      return value && ['light', 'dark', 'system'].includes(value) ? value : 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme);
    apply();
    media.addEventListener('change', apply);
    try {
      localStorage.setItem('sd-theme', theme);
    } catch {
      /* Theme remains usable when browser storage is restricted. */
    }
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return (
    <select
      className="theme-select"
      aria-label="Tema da interface"
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
    >
      <option value="light">Claro</option>
      <option value="dark">Escuro</option>
      <option value="system">Sistema</option>
    </select>
  );
}
function Login({ onLogin }: { onLogin: (user: User) => void }) {
  return (
    <main className="login-page">
      <div className="login-intro">
        <Brand />
        <p className="eyebrow">LOGÍSTICA COM CLAREZA</p>
        <h1>
          Uma operação.
          <br />
          Todas as entregas conectadas.
        </h1>
        <p>Estabelecimentos, entregadores e gestão no mesmo fluxo.</p>
        <div className="login-illustration" aria-hidden="true">
          <span>Solicitação</span>
          <i />
          <span>Coleta</span>
          <i />
          <span>Entrega</span>
        </div>
      </div>
      <Card className="login-card">
        <div className="row">
          <h2>Entre na sua operação</h2>
          <Theme />
        </div>
        <p className="muted">Use os dados fornecidos pelo administrador.</p>
        <Form
          draftKey="access"
          persistAnonymous
          fields={[
            { name: 'tenant', label: 'Identificador da empresa', min: 2, max: 80 },
            { name: 'email', label: 'E-mail', kind: 'email' },
            { name: 'password', label: 'Senha', kind: 'password', max: 128 },
          ]}
          submitLabel="Entrar"
          onSubmit={async (b) => {
            const u = await api<User>('/auth/login', 'POST', b);
            setSession(u);
            onLogin(u);
          }}
        />
        <p className="login-note">Acesso individual e restrito à sua empresa.</p>
        <div className="legal-links">
          <a href="/termos">Termos de uso</a>
          <a href="/privacidade">Privacidade</a>
        </div>
      </Card>
    </main>
  );
}
function Password({ onChanged }: { onChanged: () => void }) {
  const [logoutError, setLogoutError] = useState('');
  return (
    <main className="login-page">
      <Card className="login-card">
        <Brand />
        <h2>Defina sua senha pessoal</h2>
        <p className="muted">Sua senha inicial precisa ser alterada antes de acessar a operação.</p>
        <Form
          fields={[
            { name: 'currentPassword', label: 'Senha inicial', kind: 'password', max: 128 },
            {
              name: 'newPassword',
              label: 'Nova senha (mínimo 12 caracteres)',
              kind: 'password',
              min: 12,
              max: 128,
            },
          ]}
          submitLabel="Alterar senha e continuar"
          onSubmit={async (b) => {
            await api('/auth/password', 'POST', b);
            onChanged();
          }}
        />
        {logoutError && (
          <p className="field-error" role="alert">
            {logoutError}
          </p>
        )}
        <Button
          variant="secondary"
          onClick={() => void signOut().catch((error: Error) => setLogoutError(error.message))}
        >
          Sair da conta
        </Button>
      </Card>
    </main>
  );
}
function Legal({ privacy = false }: { privacy?: boolean }) {
  return (
    <main className="legal-page">
      <Brand />
      <h1>{privacy ? 'Privacidade' : 'Termos de uso'}</h1>
      <p>
        A Solution Delivery gerencia solicitações de entrega, cadastros profissionais e histórico
        operacional. O acesso é fornecido pela empresa de logística responsável pela sua operação.
      </p>
      {privacy ? (
        <>
          <p>
            Dados de contato, endereços e eventos são usados para executar e acompanhar entregas.
            Dados do destinatário são disponibilizados ao entregador somente após autorização.
            Solicitações sobre seus dados devem ser encaminhadas ao administrador da empresa
            responsável.
          </p>
          <p>
            Quando habilitados, Mapbox ou Google Maps recebem endereços para calcular o percurso.
            Credenciais dos serviços ficam no servidor. Preferências de tema são armazenadas no
            navegador; a sessão utiliza cookie necessário à autenticação.
          </p>
        </>
      ) : (
        <>
          <p>
            Use sua conta individual apenas para atividades autorizadas. A plataforma registra
            mudanças operacionais e não executa pagamentos ou repasses. Distâncias manuais são de
            responsabilidade do operador; estimativas de percurso não garantem prazo de entrega.
          </p>
          <p>O uso de serviços de mapas segue também os termos dos respectivos provedores.</p>
        </>
      )}
      <p>
        <a href="https://www.google.com/help/terms_maps/" target="_blank" rel="noreferrer">
          Termos do Google Maps
        </a>{' '}
        ·{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
          Privacidade do Google
        </a>{' '}
        ·{' '}
        <a href="https://www.mapbox.com/legal/tos" target="_blank" rel="noreferrer">
          Termos do Mapbox
        </a>{' '}
        ·{' '}
        <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noreferrer">
          Privacidade do Mapbox
        </a>
      </p>
      <a href="/login">Voltar ao acesso</a>
    </main>
  );
}
function Application() {
  const location = useLocation();
  const me = useQuery<User, ApiError>({
    queryKey: ['session'],
    queryFn: () => api<User>('/me'),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:1023px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width:1023px)');
    const change = () => setMobile(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    if (!drawer) {
      document.querySelector<HTMLButtonElement>('.menu-toggle')?.focus();
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.querySelector<HTMLButtonElement>('.drawer-close')?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawer(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', escape);
    };
  }, [mobile, drawer]);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    setSession(me.data ?? null);
  }, [me.data]);
  useEffect(() => {
    const expire = () => {
      client.clear();
      setSession(null);
      clearDrafts();
      window.location.assign('/login');
    };
    const online = () => {
      setOffline(false);
      void client.invalidateQueries();
    };
    const offline = () => setOffline(true);
    window.addEventListener('session-expired', expire);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('session-expired', expire);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [me.refetch]);
  useEffect(() => {
    setDrawer(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (location.pathname === '/termos' || location.pathname === '/privacidade')
    return <Legal privacy={location.pathname === '/privacidade'} />;
  if (me.isLoading) return <Loading />;
  if (me.error && !me.data && me.error.status !== 401)
    return <ErrorState message={me.error.message} retry={() => void me.refetch()} />;
  const u = me.error?.status === 401 ? undefined : me.data;
  if (!u)
    return (
      <Login
        onLogin={(user) => {
          client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
          client.getMutationCache().clear();
          client.setQueryData(['session'], user);
        }}
      />
    );
  if (u.mustChangePassword) return <Password onChanged={() => void me.refetch()} />;
  const courier = u.role === 'courier';
  const home =
    u.role === 'admin' ? '/admin' : courier ? '/entregador/ofertas' : '/estabelecimento/entregas';
  const nav =
    u.role === 'admin'
      ? ([
          ['/admin', 'Visão geral', LayoutDashboard],
          ['/admin/entregas', 'Entregas', ListChecks],
          ['/admin/estabelecimentos', 'Estabelecimentos', Building2],
          ['/admin/entregadores', 'Entregadores', Bike],
          ['/admin/usuarios', 'Usuários', UsersIcon],
          ['/admin/precos', 'Fretes e condições', Settings2],
          ['/admin/contratos', 'Contratos e escala', ListChecks],
          ['/admin/auditoria', 'Auditoria', ShieldCheck],
        ] as const)
      : ([
          ['/estabelecimento/entregas', 'Entregas', ListChecks],
          ['/estabelecimento/contratos', 'Contrato e escala', Building2],
        ] as const);
  const logout = async () => {
    try {
      await signOut();
    } catch (e) {
      setNotice({ text: (e as Error).message, error: true });
    }
  };
  return (
    <ActorContext.Provider key={actorScope(u)} value={u}>
      <NoticeContext.Provider value={(text, error = false) => setNotice({ text, error })}>
        <div className={courier ? 'courier-shell' : 'app-shell'}>
          {!courier && (
            <>
              {drawer && (
                <button
                  className="drawer-backdrop"
                  aria-label="Fechar navegação"
                  onClick={() => setDrawer(false)}
                />
              )}
              <aside
                className={`sidebar ${drawer ? 'open' : ''}`}
                aria-hidden={mobile && !drawer}
                inert={mobile && !drawer}
              >
                <div className="row">
                  <Brand />
                  <Button
                    className="drawer-close"
                    variant="ghost"
                    onClick={() => setDrawer(false)}
                    aria-label="Fechar menu"
                  >
                    <X size={20} />
                  </Button>
                </div>
                <p className="nav-label">{u.role === 'admin' ? 'GESTÃO DA EMPRESA' : 'OPERAÇÃO'}</p>
                <nav>
                  {nav.map(([path, label, Icon]) => (
                    <NavLink key={path} to={path} end={path === '/admin'}>
                      <Icon size={19} />
                      {label}
                    </NavLink>
                  ))}
                </nav>
                <div className="sidebar-note">
                  Cada etapa registrada.
                  <br />
                  Toda a operação conectada.
                </div>
                <div className="account">
                  <span className="avatar">{u.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{u.name}</strong>
                    <small>{u.tenantName}</small>
                  </div>
                </div>
              </aside>
            </>
          )}
          <div className="main-area" inert={mobile && drawer}>
            <header className="topbar">
              {courier ? (
                <Brand />
              ) : (
                <div className="row">
                  <Button
                    className="menu-toggle"
                    variant="ghost"
                    aria-label="Abrir menu"
                    aria-expanded={drawer}
                    onClick={() => setDrawer(true)}
                  >
                    <Menu size={22} />
                  </Button>
                  <span>{u.tenantName}</span>
                </div>
              )}
              <div className="actions">
                <Theme />
                <Button variant="ghost" aria-label="Sair da conta" onClick={() => void logout()}>
                  <LogOut size={18} />
                  <span className="logout-label">Sair</span>
                </Button>
              </div>
            </header>
            {me.error && me.error.status !== 401 && (
              <ErrorState
                message={`Não foi possível atualizar. Seus campos foram preservados. ${me.error.message}`}
                retry={() => void me.refetch()}
              />
            )}
            {offline && (
              <div className="connection" role="status">
                <WifiOff size={16} />
                Sem conexão. As ações dependem da confirmação do servidor.
              </div>
            )}
            <main className={courier ? 'courier-main' : 'workspace'}>
              <Suspense fallback={<Loading />}>
                <Routes>
                  {u.role === 'admin' && (
                    <>
                      <Route path="/admin" element={<Operations user={u} overview />} />
                      <Route path="/admin/entregas" element={<Operations user={u} />} />
                      <Route
                        path="/admin/estabelecimentos"
                        element={<Directory key="establishments" kind="establishments" />}
                      />
                      <Route
                        path="/admin/entregadores"
                        element={<Directory key="couriers" kind="couriers" />}
                      />
                      <Route path="/admin/usuarios" element={<Users user={u} />} />
                      <Route path="/admin/precos" element={<PricingPage />} />
                      <Route path="/admin/contratos" element={<ContractsPage user={u} />} />
                      <Route path="/admin/auditoria" element={<Audit />} />
                    </>
                  )}
                  {u.role === 'establishment' && (
                    <>
                      {' '}
                      <Route path="/estabelecimento/entregas" element={<Operations user={u} />} />
                      <Route
                        path="/estabelecimento/contratos"
                        element={<ContractsPage user={u} />}
                      />
                    </>
                  )}{' '}
                  {courier && <Route path="/entregador/*" element={<CourierApp user={u} />} />}
                  <Route path="*" element={<Navigate to={home} replace />} />
                </Routes>
              </Suspense>
            </main>
            <footer className="app-footer">
              <span>Solution Delivery</span>
              <span>Valores previstos · dados da sua operação</span>
            </footer>
          </div>
          {notice && (
            <div
              className={`toast ${notice.error ? 'toast-error' : ''}`}
              role={notice.error ? 'alert' : 'status'}
            >
              {notice.text}
            </div>
          )}
        </div>
      </NoticeContext.Provider>
    </ActorContext.Provider>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boundary>
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <Application />
        </BrowserRouter>
      </QueryClientProvider>
    </Boundary>
  </StrictMode>,
);
