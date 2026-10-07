# Arquitetura e decisões técnicas

## ADR-001 — Monólito modular

NestJS mantém módulos de autenticação, cadastros/CRM, entregas, precificação, integrações e indicadores. Domínio puro para transições e aritmética; casos de uso transacionais concentram operações. Prisma é adaptador de banco. Serviços externos implementam RoutingProvider. Não introduzir microsserviços antes de necessidade operacional medida.

## ADR-002 — Multiempresa

Banco PostgreSQL compartilhado com tenant_id obrigatório. Contexto vem da sessão, não de parâmetros do cliente. Referências compostas garantem vínculos da mesma empresa. Restrições adicionais ficam em SQL de migração. PostgreSQL não usa RLS nesta versão: autorização no servidor e testes de escopo são obrigatórios para cada novo endpoint.

## ADR-003 — Frontend por funcionalidades

React + Vite; rotas separadas por perfil; TanStack Query para estado remoto, React Hook Form + Zod para formulários. Pacote UI para primitivas visuais e contracts para tipos, rótulos e formatadores. Clientes de API e componentes não reimplementam a máquina de estados.

## ADR-004 — Autenticação

Sessão opaca persistida no banco; somente hash do token armazenado. Cookie HttpOnly, SameSite=strict, Secure em produção. CSRF vinculado à sessão e validação de Origin em mutações. Argon2id e troca obrigatória da senha inicial. Rate limit atômico no Redis compartilhado. Não guardar tokens de sessão em localStorage.

## ADR-005 — Sincronização

Polling a cada 5 segundos em telas visíveis, invalidação após mutação e recarga na reconexão/foco. Não há GPS ou promessa de rastreamento ao vivo. Em falha, o navegador preserva a chave do comando para uma tentativa segura; não há fila offline de mutações.

## ADR-006 — Escalabilidade e disponibilidade

API sem estado de sessão em memória; sessões e idempotência no PostgreSQL, rate limit no Redis. Pool limitado por réplica. Migrações executadas uma vez antes do rollout. Frontend estático servido no mesmo domínio. Compose local usa um nó: alta disponibilidade requer balanceador, múltiplas réplicas e serviços de dados redundantes.

Dados remotos no frontend usam chaves de cache vinculadas à empresa, usuário, perfil e vínculo operacional. A troca de identidade remonta a área protegida, impedindo reutilizar formulários e dados do perfil anterior.

## ADR-007 — Aplicativo nativo Expo

O usuário solicitou app nativo após a entrega inicial. Expo SDK 57, React Native e TypeScript em apps/mobile. Contracts compartilha tipos e formatação; componentes React Native ficam separados dos componentes DOM. TanStack Query mantém dados remotos, consulta somente em primeiro plano e invalida após comandos. Sessão/cache são descartados na troca de conta.

POST /auth/mobile/login emite sessão opaca de 12h somente para entregadores. O banco guarda hash e canal mobile; SecureStore guarda token e vencimento no dispositivo. Authorization Bearer autentica chamadas nativas sem cookies/Origin/CSRF. Sessões web só funcionam por cookie e continuam exigindo Origin e CSRF em mutações. Tokens móveis não funcionam como cookie, tokens web não funcionam como Bearer. Requisições do canal móvel com Origin são rejeitadas. Logout, desativação, reset e expiração revogam acesso. Não há renovação silenciosa nem fila offline de ações.

No desenvolvimento com Expo Go, o host do manifesto fornece a origem da API e um middleware Metro permite somente os endpoints nativos do entregador, encaminhados à API loopback. O proxy ignora cookies e rejeita Origin de browser; o backend mantém autenticação e autorização. Não há esse servidor no APK/IPA, que continua usando URL configurada.

## ADR-008 — Mapa local e despacho visual de ofertas

O app nativo utiliza react-native-maps e Expo Location em primeiro plano. Coordenadas são locais ao dispositivo e não alteram a elegibilidade de ofertas da empresa. Popup sequencial substitui a lista; decisões continuam nos endpoints existentes com versão e idempotência. Nenhuma oferta é reservada só por ser exibida. O servidor mantém a exclusividade de uma entrega ativa por entregador.
