# Publicação na Vercel

O monorepo publica dois projetos independentes do mesmo repositório. Os painéis CRM, loja e entregador web pertencem ao mesmo app React; o perfil autenticado determina a interface.

| Projeto | Root Directory | Framework | Saída           |
| ------- | -------------- | --------- | --------------- |
| Painéis | `apps/web`     | Vite      | `dist`          |
| Backend | `apps/api`     | NestJS    | Vercel Function |

Use Node 24. Habilite o acesso a arquivos fora de Root Directory para os pacotes compartilhados e o lockfile do monorepo. `apps/api/vercel.json` gera o Prisma Client antes do build e usa a região São Paulo (`gru1`). `apps/web/vercel.ts` define o proxy da API e o fallback das rotas React.

## Variáveis

No projeto backend, configure para o ambiente publicado:

- `NODE_ENV=production`
- `APP_ORIGIN`: origem HTTPS exata do projeto dos painéis, sem caminho ou barra final.
- `DATABASE_URL`: conexão PostgreSQL acessível pela Vercel, preferencialmente endpoint com pool de conexões e TLS fornecido pelo serviço.
- `REDIS_URL`: conexão Redis TCP/TLS acessível pela Vercel; Use `rediss://` quando o serviço exigir TLS. Em alternativa, configure `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`; quando ambas estiverem presentes, o backend utiliza HTTPS e não necessita de REDIS_URL.
- `DB_POOL_MAX=2`: limite inicial por instância; ajuste conforme capacidade do banco e tráfego.
- `GOOGLE_MAPS_KEY` e/ou `MAPBOX_TOKEN`: opcionais para serviços de rotas; nunca publique segredos no frontend.

No projeto dos painéis, configure `API_ORIGIN` com a origem HTTPS do projeto backend, sem `/api/v1`. Esse valor alimenta a configuração da Vercel, e não o bundle React. Ausência ou endereço inválido interrompe a configuração para evitar publicar painéis com um proxy inválido. A configuração usa `vercel.ts` com exportação padrão, executada pelo compilador da Vercel para resolver `API_ORIGIN`. Não renomeie esse arquivo para `.mjs`: a leitura estática usada no deploy Git pode omitir destinos calculados e causar o erro `rewrites[0] missing required property destination`.

Nenhuma variável `VITE_*` precisa conter chaves ou credenciais. `.env`, dados locais, credenciais de contas, dependências e bundles não entram no repositório. PostgreSQL e Redis do Docker local não são alcançáveis pelas Functions da Vercel.

## Ordem de publicação

1. Crie/importe os dois projetos do repositório e configure seus Root Directories. Obtenha os domínios estáveis de produção.
2. Configure as variáveis dos dois projetos. `APP_ORIGIN` aponta para os painéis; `API_ORIGIN` aponta para o backend.
3. Aplique as migrações no PostgreSQL do ambiente de destino com `corepack pnpm --filter @solution/api db:migrate`. Execute em uma sessão com as credenciais desse ambiente configuradas. O build não modifica o schema automaticamente.
4. Publique o backend e confirme `/api/v1/health/ready`, que verifica PostgreSQL e Redis. Falhas de autenticação/serviços não devem ser confundidas com deploy saudável apenas porque `/health/live` respondeu.
5. Publique os painéis e confirme `/api/v1/health/ready` pelo domínio dos painéis, via proxy.
6. Valide login, cookie Secure/HttpOnly, CSRF, loja, CRM e uma entrega completa. O proxy mantém chamadas no mesmo domínio do navegador; não exige cookies entre domínios nem alteração das proteções de autenticação.

Provisionamento de empresas e primeiro administrador segue [operação](operacao.md). Não execute seed demonstrativo em produção nem publique senhas de demonstração. O app Expo/APK é distribuído separadamente; no APK configure `EXPO_PUBLIC_API_URL=https://DOMINIO-DO-BACKEND/api/v1`.

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
