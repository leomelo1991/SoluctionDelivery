import { FinanceEarnings } from '../components/FinanceEarnings';
import { useCourierTracking } from '../core/useCourierTracking';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import type { Courier, Dashboard, Delivery, Offer, Page } from '@solution/contracts';
import { dateTime, formatAddress, labels, money, today } from '@solution/contracts';
import {
  Button,
  Card,
  Copy,
  Empty,
  ErrorNotice,
  Loading,
  Screen,
  styles,
  useTheme,
} from '../components/ui';
import { DateField } from '../components/DateField';
import { DeliveryPanel } from '../components/DeliveryPanel';
import { latestDelivery } from '../core/navigation';
import { CourierMap } from '../components/CourierMap';
import { OfferPopup } from '../components/OfferPopup';
import { nextOffer, offerKey } from '../core/offers';
import { useForeground } from '../core/foreground';
import { Confirm } from '../components/Confirm';
import { useAction, useData } from '../core/queries';
import { useSession } from '../core/session';
import { historyPeriod } from '../core/delivery';
import { useMobileDraft } from '../core/drafts';
type Tab = 'home' | 'history' | 'account';
interface Command {
  path: string;
  method?: string;
  body?: object;
  title: string;
  description: string;
}
export function CourierHome() {
  const { user, logout } = useSession();
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('home');
  const [page, setPage] = useState(1);
  const [command, setCommand] = useState<Command | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [from, setFrom] = useMobileDraft('historyFrom', today);
  const [to, setTo] = useMobileDraft('historyTo', today);
  const [period, setPeriod] = useMobileDraft('historyPeriod', () =>
    historyPeriod(today(), today()),
  );
  const foreground = useForeground();
  const courier = useData<Courier>('/couriers/me', foreground, 20000);
  const offers = useData<Page<Offer>>('/couriers/me/offers?page=1&pageSize=30', foreground, 5000);
  const active = useData<Page<Delivery>>('/deliveries?status=active', foreground, 5000);
  const [confirmedDelivery, setConfirmedDelivery] = useState<Delivery>();
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const current = latestDelivery(
    active.data?.items.find((d) => d.status !== 'assigned'),
    confirmedDelivery,
  );
  const details = useData<Delivery>(
    `/deliveries/${current?.id ?? 'none'}`,
    foreground && tab === 'home' && !!current && current.status !== 'delivered',
    10000,
  );
  const history = useData<Page<Delivery>>(
    `/deliveries?status=delivered&page=${page}&${period}`,
    foreground && tab === 'history',
  );
  const dashboard = useData<Dashboard>(`/dashboard?${period}`, foreground && tab === 'history');
  const observed =
    details.data?.id === current?.id ? latestDelivery(current, details.data) : current;
  const delivery =
    observed && (observed.status !== 'delivered' || !completionDismissed) ? observed : undefined;
  const action = useAction<Delivery>();
  const profile = courier.data;
  const sharing =
    profile?.approvalStatus === 'approved' &&
    ['available', 'busy'].includes(profile.availabilityStatus);
  const gps = useCourierTracking(foreground && (tab === 'home' || sharing), foreground && sharing);

  const select = (next: Tab) => {
    setTab(next);
    setPage(1);
    setError(null);
  };
  const ask = (value: Command) => {
    setError(null);
    setCommand(value);
  };
  async function execute() {
    if (!command) return;
    setError(null);
    try {
      const changed = await action.mutateAsync(command);
      if (command.path.startsWith('/deliveries/') && delivery) {
        setConfirmedDelivery({ ...delivery, ...changed });
        setCompletionDismissed(false);
      }
      setCommand(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível confirmar.');
    }
  }
  const [handled, setHandled] = useState<Set<string>>(() => new Set());
  const [decision, setDecision] = useState<{ offer: Offer; action: 'accept' | 'decline' } | null>(
    null,
  );
  const [offerError, setOfferError] = useState<string | null>(null);
  const offerLock = useRef(false);
  const currentOfferId = useRef<string | undefined>(undefined);
  const candidate =
    foreground &&
    active.data &&
    Date.now() - offers.dataUpdatedAt < 15000 &&
    Date.now() - active.dataUpdatedAt < 15000 &&
    !command &&
    !signingOut
      ? nextOffer(offers.data?.items ?? [], profile, !!delivery, handled, currentOfferId.current)
      : null;
  const popup = foreground ? (decision?.offer ?? candidate) : null;
  useEffect(() => {
    currentOfferId.current = candidate?.id;
  }, [candidate?.id]);
  useEffect(() => {
    setOfferError(null);
  }, [popup?.id, popup?.version]);
  async function respond(offer: Offer, name: 'accept' | 'decline') {
    if (offerLock.current || action.isPending) return;
    offerLock.current = true;
    setDecision({ offer, action: name });
    setOfferError(null);
    try {
      const changed = await action.mutateAsync({
        path: `/deliveries/${offer.id}/${name}`,
        body: { version: offer.version },
      });
      setHandled((old) => new Set(old).add(offerKey(offer)));
      if (name === 'accept') {
        setConfirmedDelivery({
          ...changed,
          establishment: changed.establishment,
        });
        setCompletionDismissed(false);
        select('home');
      }
    } catch (e) {
      setOfferError(e instanceof Error ? e.message : 'Não foi possível responder à oferta.');
    } finally {
      offerLock.current = false;
      setDecision(null);
    }
  }
  const refreshed =
    courier.isRefetching ||
    (tab === 'home'
      ? offers.isRefetching
      : tab === 'history'
        ? history.isRefetching
        : active.isRefetching);
  const refresh = () => {
    void courier.refetch();
    void active.refetch();
    if (tab === 'home') void offers.refetch();
    if (tab === 'history') {
      void history.refetch();
      void dashboard.refetch();
    }
    if (tab === 'home' && delivery) void details.refetch();
  };
  const availabilityButton = profile && (
    <Button
      secondary
      disabled={
        action.isPending ||
        profile.approvalStatus !== 'approved' ||
        profile.availabilityStatus === 'busy'
      }
      title={profile.availabilityStatus === 'available' ? 'Ficar indisponível' : 'Ficar disponível'}
      onPress={() =>
        ask({
          path: '/couriers/me/availability',
          method: 'PATCH',
          body: { status: profile.availabilityStatus === 'available' ? 'offline' : 'available' },
          title: 'Alterar disponibilidade',
          description:
            profile.availabilityStatus === 'available'
              ? 'Você deixará de receber novas ofertas.'
              : 'Você poderá receber ofertas da sua empresa.',
        })
      }
    />
  );
  const availability = courier.isLoading ? (
    <Loading />
  ) : courier.error ? (
    <ErrorNotice message={courier.error.message} retry={() => void courier.refetch()} />
  ) : (
    profile && (
      <Card>
        <Copy title>
          {profile.approvalStatus === 'approved'
            ? labels[profile.availabilityStatus]
            : labels[profile.approvalStatus]}
        </Copy>
        <Copy muted>
          {profile.approvalStatus === 'pending'
            ? 'Seu cadastro aguarda aprovação da empresa.'
            : profile.approvalStatus === 'paused'
              ? 'Fale com a operação para reativar seu cadastro.'
              : profile.availabilityStatus === 'busy'
                ? 'Uma entrega está reservada ou em andamento.'
                : profile.availabilityStatus === 'available'
                  ? 'Você está disponível para novas ofertas.'
                  : 'Ative sua disponibilidade para receber ofertas.'}
        </Copy>
        {availabilityButton}
      </Card>
    )
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {sharing && (
        <View style={{ padding: 8 }}>
          <Copy muted>
            {gps.tracking.status !== 'ready'
              ? 'Localização indisponível. Permita o GPS na tela Início para aparecer na operação.'
              : gps.upload === 'error'
                ? 'Falha ao compartilhar o GPS. Tentando novamente…'
                : gps.upload === 'sent'
                  ? 'GPS compartilhado com a operação enquanto o app está aberto.'
                  : 'Preparando compartilhamento do GPS…'}
          </Copy>
        </View>
      )}
      <View style={{ flex: 1, display: tab === 'home' ? 'flex' : 'none' }}>
        {!delivery && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <Copy>Olá, {user?.name.split(' ')[0]}.</Copy>
          </View>
        )}
        <CourierMap
          active={foreground && tab === 'home'}
          tracking={gps.tracking}
          onRetry={() => void gps.retry()}
          delivery={delivery}
          bottomInset={delivery ? panelHeight : 0}
        />
        {delivery && (
          <DeliveryPanel
            key={delivery.id}
            delivery={delivery}
            pending={action.isPending}
            error={error || details.error?.message}
            onHeight={setPanelHeight}
            onDismiss={() => setCompletionDismissed(true)}
            onStep={(step) =>
              ask({
                path: `/deliveries/${delivery.id}/${step.action}`,
                body: { version: delivery.version },
                title: step.label,
                description: step.confirmation,
              })
            }
          />
        )}
        {!delivery && (
          <View style={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
            {profile ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Copy>
                    {profile.approvalStatus === 'approved'
                      ? labels[profile.availabilityStatus]
                      : labels[profile.approvalStatus]}
                  </Copy>
                </View>
                <View style={{ flex: 1 }}>{availabilityButton}</View>
              </View>
            ) : courier.isLoading ? (
              <Loading />
            ) : null}
            {(courier.error || offers.error || (error && !command)) && (
              <ScrollView style={{ maxHeight: 96 }}>
                {courier.error && (
                  <ErrorNotice
                    message={courier.error.message}
                    retry={() => void courier.refetch()}
                  />
                )}
                {offers.error && (
                  <ErrorNotice message={offers.error.message} retry={() => void offers.refetch()} />
                )}
                {error && !command && <ErrorNotice message={error} />}
              </ScrollView>
            )}
          </View>
        )}
      </View>
      {tab !== 'home' && (
        <Screen
          refreshControl={
            <RefreshControl refreshing={refreshed} onRefresh={refresh} tintColor={t.primary} />
          }
        >
          <Copy muted>{user?.tenantName.toUpperCase()}</Copy>
          <Copy title>Olá, {user?.name.split(' ')[0]}.</Copy>
          {availability}
          {error && !command && <ErrorNotice message={error} />}
          {tab === 'history' && (
            <>
              <Copy title>Entregas concluídas</Copy>
              <Card>
                <DateField label="De" value={from} onChange={setFrom} />
                <DateField label="Até" value={to} onChange={setTo} />
                <Button
                  secondary
                  title="Aplicar período"
                  onPress={() => {
                    try {
                      setPeriod(historyPeriod(from, to));
                      setPage(1);
                      setError(null);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
                {dashboard.error ? (
                  <ErrorNotice
                    message={dashboard.error.message}
                    retry={() => void dashboard.refetch()}
                  />
                ) : dashboard.data ? (
                  <>
                    <Copy muted>Remuneração prevista no período</Copy>
                    <Copy title>{money(dashboard.data.expectedPayoutCents ?? 0)}</Copy>
                    <Copy>{dashboard.data.delivered} entregas concluídas</Copy>
                  </>
                ) : (
                  <Loading />
                )}
              </Card>
              {history.isLoading ? (
                <Loading />
              ) : history.error ? (
                <ErrorNotice message={history.error.message} retry={() => void history.refetch()} />
              ) : history.data?.items.length ? (
                history.data.items.map((d) => (
                  <Card key={d.id}>
                    <Copy>
                      #{d.code} · {d.establishment.name}
                    </Copy>
                    <Copy title>{money(d.courierPayoutCents)}</Copy>
                    <Copy muted>Concluída em {dateTime(d.updatedAt)}</Copy>
                    <Copy>{formatAddress(d.destinationAddress)}</Copy>
                  </Card>
                ))
              ) : (
                <Empty
                  title="Nenhuma entrega no período"
                  description="Suas entregas concluídas aparecerão aqui."
                />
              )}
              {history.data && <Pages data={history.data} onChange={setPage} />}
            </>
          )}
          {tab === 'history' && <FinanceEarnings />}
          {tab === 'account' && (
            <Card>
              <Copy title>Minha conta</Copy>
              <Copy>{user?.name}</Copy>
              <Copy muted>{user?.email}</Copy>
              <Copy>{user?.tenantName}</Copy>
              {profile && <Copy>Veículo: {labels[profile.vehicle] ?? profile.vehicle}</Copy>}
              <Copy muted>
                Para corrigir seu cadastro ou recuperar o acesso, fale com a operação.
              </Copy>
              <Button
                secondary
                title={signingOut ? 'Saindo…' : 'Sair da conta'}
                disabled={signingOut || action.isPending}
                onPress={() => {
                  setSigningOut(true);
                  void logout()
                    .catch((e) => setError(e.message))
                    .finally(() => setSigningOut(false));
                }}
              />
            </Card>
          )}
          <Copy muted>
            Atualização automática enquanto o app estiver aberto. Puxe para atualizar.
          </Copy>
        </Screen>
      )}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: t.surface,
          borderTopWidth: 1,
          borderTopColor: t.border,
        }}
      >
        {(
          [
            ['home', 'Início'],
            ['history', 'Histórico'],
            ['account', 'Conta'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            accessibilityLabel={label}
            onPress={() => select(key)}
            style={{
              flex: 1,
              minHeight: 64,
              justifyContent: 'center',
              alignItems: 'center',
              borderTopWidth: 3,
              borderTopColor: tab === key ? t.primary : 'transparent',
            }}
          >
            <Copy muted={tab !== key}>{label}</Copy>
          </Pressable>
        ))}
      </View>
      {popup && (
        <OfferPopup
          offer={popup}
          pending={decision?.action ?? null}
          error={offerError ?? undefined}
          onAccept={() => void respond(popup, 'accept')}
          onDecline={() => void respond(popup, 'decline')}
        />
      )}
      {command && (
        <Confirm
          title={command.title}
          description={command.description}
          pending={action.isPending}
          error={error ?? undefined}
          onConfirm={() => void execute()}
          onClose={() => {
            setCommand(null);
            setError(null);
          }}
        />
      )}
    </View>
  );
}
function Pages({ data, onChange }: { data: Page<unknown>; onChange: (page: number) => void }) {
  return data.total > data.pageSize ? (
    <View style={styles.gap}>
      <Copy muted>
        Página {data.page} de {Math.ceil(data.total / data.pageSize)}
      </Copy>
      <Button
        title="Página anterior"
        secondary
        disabled={data.page <= 1}
        onPress={() => onChange(data.page - 1)}
      />
      <Button
        title="Próxima página"
        secondary
        disabled={data.page * data.pageSize >= data.total}
        onPress={() => onChange(data.page + 1)}
      />
    </View>
  ) : null;
}
