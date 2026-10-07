# Operação e implantação

## Desenvolvimento

Siga o README. Variáveis são carregadas da raiz ou da pasta de execução. `.env.example` contém somente valores locais; `.env` é ignorado. API valida DATABASE_URL, REDIS_URL, NODE_ENV, PORT e APP_ORIGIN ao iniciar. Navegador acessa API pelo proxy Vite ou Nginx no mesmo domínio.

## Provisionamento assistido

Empresa começa sem tarifas e sem dados de exemplo. Não há portal público nem administrador global web.

```sh
export TENANT_SLUG=minha-operacao
export TENANT_NAME='Minha Operação'
export ADMIN_NAME='Administrador'
export ADMIN_EMAIL=admin@example.com
read -s ADMIN_PASSWORD
export ADMIN_PASSWORD
corepack pnpm provision
unset ADMIN_PASSWORD
```

A criação é transacional, auditada e não sobrescreve empresa existente. Senha mínima de 12 caracteres. Administrador troca senha inicial, cadastra parceiros, ativa relacionamento/operação, cadastra e aprova entregadores, cria seus usuários e configura preços.

Em Docker, executar o script compilado no container API com essas variáveis exportadas:

```sh
docker compose --profile app exec -e TENANT_SLUG -e TENANT_NAME -e ADMIN_NAME -e ADMIN_EMAIL -e ADMIN_PASSWORD api node dist/scripts/provision.js
```

Não incluir senha em argumentos de linha de comando, arquivos versionados ou logs.

## Provedores de rota

Definir MAPBOX_TOKEN e GOOGLE_MAPS_KEY no ambiente da API. Habilitar Geocoding e Routes no Google e o acesso a Geocoding/Directions no Mapbox. Restringir credenciais ao backend e APIs necessárias. Recriar API após mudança de ambiente. Empresas escolhem prioridade e alternativa no CRM. Não há chamadas reais durante seed ou testes controlados.

## Produção

Usar senhas fortes e URL-safe para banco (ou codificar corretamente a URL), APP_ORIGIN com origem HTTPS exata e NODE_ENV=production. Colocar proxy TLS diante do serviço web, restringir portas de banco/Redis à rede privada e substituir endpoints locais pelos serviços gerenciados quando necessário. Executar `docker compose -f compose.yaml -f compose.production.yaml --profile app up --build -d` somente com a origem HTTPS já atendida pelo proxy TLS.

A API recusa configuração de produção com APP_ORIGIN sem HTTPS. Secure cookies exigem HTTPS. Não usar o override de produção para acesso HTTP local. Textos de termos/privacidade incluídos são a descrição funcional inicial: parametrizar identificação e canal do controlador responsável antes de publicação comercial.

## Atualização

Construir e testar imagens antes do rollout. Fazer backup do banco. Executar migrate deploy uma única vez e aguardar sucesso. Reiniciar réplicas usando readiness; liveness não depende do banco. As migrações deste repositório criam tabelas em banco vazio; futuras alterações devem preservar compatibilidade durante rollout. Não executar migrate dev nem db push em produção.

## Backup e restauração

Banco é fonte de verdade. Exemplo de backup local:

```sh
docker compose exec -T postgres pg_dump -U solution -d solution -Fc > backup.dump
```

Restaurar em banco de recuperação vazio, conferir migrações e verificar uma jornada antes de trocar o tráfego. Definir frequência, retenção, cópia externa e responsáveis conforme o contrato de operação. Redis armazena limitação de requisições, sem entregas ou sessões; sua perda não apaga registros operacionais.

## Observabilidade e escala

Logs JSON incluem requestId, método, caminho, status e duração, sem corpo ou credenciais. Readiness em /api/v1/health/ready consulta banco/Redis. Monitorar erros 5xx, conflitos, latência, saturação de pool, falhas de provedores e uso de banco/Redis. Integrar logs e alertas ao provedor de observabilidade da implantação.

Pool de banco limitado a 10 conexões por réplica. Dimensionar réplicas e limite do banco juntos. Sessões, idempotência e rate limit são compartilhados. Frontend estático pode ser replicado. Para alta disponibilidade real: balanceador, APIs em domínios de falha diferentes, PostgreSQL com failover, Redis redundante e teste de recuperação. O Compose padrão é execução portável em um nó.

Agendar manutenção de sessões vencidas e cotações não consumidas antigas; não excluir histórico financeiro/auditoria. Registros de idempotência de entregas devem permanecer pelo prazo da operação que protegem.
