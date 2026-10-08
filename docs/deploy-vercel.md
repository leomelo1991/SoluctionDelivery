# Publicação na Vercel

O monorepo publica dois projetos independentes do mesmo repositório. Os painéis CRM, loja e entregador web pertencem ao mesmo app React; o perfil autenticado determina a interface.

| Projeto | Root Directory | Framework | Saída           |
| ------- | -------------- | --------- | --------------- |
| Painéis | `apps/web`     | Vite      | `dist`          |
| Backend | `apps/api`     | NestJS    | Vercel Function |

Use Node 24. Habilite o acesso a arquivos fora de Root Directory para os pacotes compartilhados e o lockfile do monorepo. `apps/api/vercel.json` gera o Prisma Client antes do build e usa a região São Paulo (`gru1`). `apps/web/vercel.json` define o proxy da API e o fallback das rotas React com destinos literais.

## Variáveis

No projeto backend, configure para o ambiente publicado:

- `NODE_ENV=production`
- `APP_ORIGIN`: origem HTTPS exata do projeto dos painéis, sem caminho ou barra final.
- `DATABASE_URL`: conexão PostgreSQL acessível pela Vercel, preferencialmente endpoint com pool de conexões e TLS fornecido pelo serviço.
- `REDIS_URL`: conexão Redis TCP/TLS acessível pela Vercel; Use `rediss://` quando o serviço exigir TLS. Em alternativa, configure `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`; quando ambas estiverem presentes, o backend utiliza HTTPS e não necessita de REDIS_URL.
- `DB_POOL_MAX=2`: limite inicial por instância; ajuste conforme capacidade do banco e tráfego.
- `GOOGLE_MAPS_KEY` e/ou `MAPBOX_TOKEN`: opcionais para serviços de rotas; nunca publique segredos no frontend.

O destino do backend é uma URL HTTPS literal na primeira regra `rewrites` de `apps/web/vercel.json`, seguida de `/api/:path*`. Ao mudar o domínio do backend, atualize essa regra no repositório. `API_ORIGIN` não é usada para resolver esse destino: o JSON contém o destino completo, sem depender de expressões JavaScript ou substituição de variáveis de ambiente. Mantenha apenas `vercel.json` como configuração dos painéis; isso evita depender da compilação de `vercel.ts` ou `vercel.mjs` para preencher o campo obrigatório `destination`.

O build valida o proxy antes de compilar o painel. Se o destino coincidir com `VERCEL_PROJECT_PRODUCTION_URL` ou `VERCEL_URL`, ele falha com uma mensagem para configurar o domínio do backend (`apps/api`), evitando encaminhar a API para o próprio painel.

Nenhuma variável `VITE_*` precisa conter chaves ou credenciais. `.env`, dados locais, credenciais de contas, dependências e bundles não entram no repositório. PostgreSQL e Redis do Docker local não são alcançáveis pelas Functions da Vercel.

## Ordem de publicação

1. Crie/importe os dois projetos do repositório e configure seus Root Directories. Obtenha os domínios estáveis de produção.
2. Configure as variáveis dos dois projetos. `APP_ORIGIN` aponta para os painéis; o destino literal em `apps/web/vercel.json` aponta para o backend.
3. Aplique as migrações no PostgreSQL do ambiente de destino com `corepack pnpm --filter @solution/api db:migrate`. Execute em uma sessão com as credenciais desse ambiente configuradas. O build de produção da Vercel também executa `db:migrate` depois da compilação; falhas interrompem o deploy. Builds Preview não executam migrations nem seed.
4. Publique o backend e confirme `/api/v1/health/ready`, que verifica PostgreSQL e Redis. Falhas de autenticação/serviços não devem ser confundidas com deploy saudável apenas porque `/health/live` respondeu.
5. Publique os painéis e confirme `/api/v1/health/ready` pelo domínio dos painéis, via proxy.
6. Valide login, cookie Secure/HttpOnly, CSRF, loja, CRM e uma entrega completa. O proxy mantém chamadas no mesmo domínio do navegador; não exige cookies entre domínios nem alteração das proteções de autenticação.

Provisionamento de empresas e primeiro administrador segue [operação](operacao.md). Para habilitar dados demonstrativos, siga a seção abaixo; não publique senhas de demonstração. O app Expo/APK é distribuído separadamente; no APK configure `EXPO_PUBLIC_API_URL=https://DOMINIO-DO-BACKEND/api/v1`.

## Validação e estado

Configuração de proxy, conexão Redis concorrente e builds locais são verificados antes da publicação. Deploy só está concluído após existir URL publicada e readiness/login verificados. O repositório privado pode ser publicado pela integração GitHub, mesmo quando a pasta local não oferece metadados Git graváveis. Publicar na Vercel requer acesso à conta/equipe e conexões de banco/Redis de destino; não colocar tokens no chat.

Referências: [NestJS na Vercel](https://vercel.com/docs/frameworks/backend/nestjs), [configuração programática](https://vercel.com/docs/project-configuration/vercel-ts) e [rewrites](https://vercel.com/docs/routing/rewrites).

## Pacote Git importável

Quando a publicação remota estiver bloqueada na sessão, `artifacts/solution-delivery.bundle` contém o commit completo e permite publicá-lo em uma sessão com acesso GitHub. O bundle não contém `.env`, dependências ou metadados de autenticação. Para um repositório remoto vazio:

```sh
git clone artifacts/solution-delivery.bundle /tmp/solution-delivery-publicar
git -C /tmp/solution-delivery-publicar remote set-url origin https://github.com/leomelo1991/SoluctionDelivery.git
git -C /tmp/solution-delivery-publicar push -u origin main
```

Se o remoto já tiver commits, integre os históricos antes de enviar; não use force push. A presença do bundle não significa que o código já foi enviado nem que os projetos Vercel foram publicados.

## Neon e Upstash na equipe leo-dev10

O destino informado é a equipe Vercel `leo-dev10`. O usuário autorizou um novo projeto Neon, separado do PostgreSQL existente, e a integração de Redis. Selecione planos gratuitos quando disponíveis; não ative upgrade automático ou recursos pagos como parte deste provisionamento.

No Marketplace da Vercel, crie um recurso Neon próprio para este projeto e associe ao backend. Configure `DATABASE_URL` com conexão pooled; para migrações, use a conexão direta fornecida pelo Neon em uma sessão de release. Um banco recém-criado precisa das migrações e do provisionamento de uma empresa/administrador antes de o login funcionar.

Associe um Upstash Redis ao backend e use as variáveis privadas `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` fornecidas pela integração. O transporte HTTP implementa EVAL para manter incremento e expiração de rate limit atômicos, com timeout de cinco segundos e sem repetição automática de comandos. Respostas inválidas, ausência de autorização e indisponibilidade bloqueiam a requisição; não desabilitam a proteção. Readiness consulta PING de fato. O transporte TCP do Docker continua disponível quando as variáveis Upstash não estiverem configuradas.

Na sessão em que este pacote foi preparado, o envio GitHub foi negado porque a ferramenta exigiu aprovação e a política da sessão é never. Os plugins Vercel e Neon foram encontrados, mas não estavam instalados/conectados. Portanto, nenhum banco Neon, Redis Upstash, projeto Vercel ou deploy remoto foi criado ou alegado como criado. O bundle registra o código pronto para prosseguir em uma sessão com acesso de publicação.

Referências: [Neon no Marketplace](https://vercel.com/marketplace/neon/neon), [Upstash no Marketplace](https://vercel.com/marketplace/upstash) e [REST API Upstash](https://upstash.com/docs/redis/features/restapi).

## Demo no deploy de produção

No projeto **da API**, configure estas variáveis apenas no ambiente **Production**:

- `ALLOW_DEMO_SEED=true`
- `ALLOW_PRODUCTION_DEMO_SEED=true`
- `DEMO_PASSWORD`: senha inicial de 12 a 128 caracteres, cadastrada como segredo. Cole o valor puro no painel da Vercel, sem aspas adicionais.

Mantenha `DATABASE_URL`, Redis e `APP_ORIGIN` configurados. Remova overrides antigos de Build Command para usar o comando de `apps/api/vercel.json`: `corepack pnpm db:generate && corepack pnpm build && node dist/scripts/vercel-release.js`. Faça Redeploy do projeto da API.

O build aplica migrations e, quando autorizado, cria a empresa `demo`, os usuários `admin@example.test`, `loja@example.test`, `entregador@example.test`, uma loja, um entregador e tarifas/região de exemplo. Todos os usuários exigem troca da senha inicial. O seed não cria entregas.

A criação é transacional e serializada entre builds concorrentes. Se a empresa `demo` já existir, o seed termina com sucesso sem alterar registros ou senhas, nem preencher dados faltantes. Para uma empresa já provisionada, cadastre os demais dados pelo painel. Alterar `DEMO_PASSWORD` não redefine senhas existentes. Após a primeira execução, remova as três variáveis do seed; os cadastros permanecem no banco.
