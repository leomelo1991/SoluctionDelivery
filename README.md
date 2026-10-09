# Solution Delivery

SaaS de gestão de entregas com painel do estabelecimento, aplicativo web do entregador e CRM da empresa de logística. NestJS, React, Prisma e PostgreSQL; dados e permissões isolados por empresa.

A [base de conhecimento](docs/README.md) registra regras, arquitetura, contratos e operação. A [referência original](diversos/solution-delivery-codex-completo.md) foi preservada, e seus protótipos estão em `referencias/`.

## Executar localmente

Requisitos: Node.js 24, Corepack e Docker com Compose.

```sh
cp .env.example .env
corepack pnpm install --frozen-lockfile
corepack pnpm db:generate
docker compose up -d postgres redis
corepack pnpm db:migrate
corepack pnpm dev
```

Frontend: http://localhost:5173. API: http://localhost:3000/api/v1. Swagger: http://localhost:3000/api/docs.

Para experimentar dados demonstrativos, escolha uma senha de pelo menos 12 caracteres e execute:

```sh
read -s DEMO_PASSWORD
export DEMO_PASSWORD
ALLOW_DEMO_SEED=true corepack pnpm seed:demo
unset DEMO_PASSWORD
```

Empresa `demo`; usuários `admin@example.test`, `loja@example.test` e `entregador@example.test`. Todos exigem troca da senha inicial. Seed é opcional, não sobrescreve cadastros e em produção exige autorização adicional; veja [deploy Vercel](docs/deploy-vercel.md).

Para provisionar uma empresa real, use o [guia operacional](docs/operacao.md). Nenhuma credencial de produção é incluída no projeto.

## Aplicação completa em Docker

```sh
docker compose --profile app up --build -d
```

Acesse http://localhost:8080. O job de migração termina antes de liberar a API. Consulte o guia para provisionamento dentro do container, HTTPS e produção.

## Verificações

```sh
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:integration
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
corepack pnpm build
```

Integração e navegador exigem PostgreSQL/Redis acessíveis e migração aplicada. Testes criam e removem apenas suas próprias empresas. O navegador utiliza sessões independentes dos três perfis.

## Funcionalidades

- Cadastros, aprovação, usuários, notas CRM, indicadores e auditoria.
- Ofertas abertas ou dirigidas, aceite, chegada, retirada e conclusão persistentes.
- Proteção transacional contra dois aceites ou duas reservas para o mesmo entregador.
- Frete por distância ou região, cobrança/remuneração separadas e acréscimos cumulativos.
- Mapbox e Google com alternativa em falhas técnicas; distância manual auditada.
- Temas claro, escuro e sistema; interface responsiva e componentes compartilhados.

Os mapas dos painéis usam Leaflet + OpenStreetMap sem chave pública. Rotas e geocodificação usam `OPENROUTESERVICE_API_KEY` no backend. Sem ela, tarifa regional e distância manual funcionam. Veja [configuração na Vercel](docs/mapas-vercel.md). Não há GPS contínuo, pagamentos, assinatura SaaS, cancelamento ou reatribuição de entrega ativa. Docker Compose em um nó não fornece alta disponibilidade.

## App nativo do entregador (Expo)

O app Android/iOS está em `apps/mobile`, integrado à mesma API e aos mesmos cadastros. Inclui login, troca inicial de senha, disponibilidade, ofertas em popup, mapa com localização da moto, etapas, ligação e histórico.

```sh
cp apps/mobile/.env.example apps/mobile/.env
# Para APK, ajuste EXPO_PUBLIC_API_URL. No Expo Go, a API usa o proxy local do Metro.
corepack pnpm mobile
```

Use Expo Go compatível com SDK 57 para abrir o QR code. Para APK e publicação, consulte o [guia do app](docs/app-entregador.md).

Para testar no Expo Go de outra rede, mantenha a API Docker ativa e execute `corepack pnpm mobile:remote`. O modo de desenvolvimento usa o mesmo túnel do QR code para código e API; reinicie Expo após alterações em metro.config.cjs. Consulte o guia para indisponibilidade do Ngrok e destino alternativo da API local.

## Publicação na Vercel

Os painéis React e o backend NestJS têm configuração própria para dois projetos Vercel do mesmo monorepo. Consulte [deploy na Vercel](docs/deploy-vercel.md) para variáveis, PostgreSQL/Redis externos, migrações e validação.
