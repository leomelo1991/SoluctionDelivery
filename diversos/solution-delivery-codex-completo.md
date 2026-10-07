# Solution Delivery — Guia integrado para desenvolvimento no Codex

Documento único com escopo, identidade visual atualizada, regras de negócio e código de referência das três áreas. Adicione este arquivo ao projeto no Codex e use a instrução abaixo para iniciar a implementação.

## 1. Instrução inicial para o Codex

Leia este documento, examine o repositório e implemente a **Solution Delivery**, uma plataforma de gestão de entregas com três interfaces conectadas ao mesmo backend e banco de dados:

1. Painel do estabelecimento: operação das entregas do próprio estabelecimento.
2. App web do entregador: disponibilidade, ofertas, aceitação, coleta e conclusão.
3. CRM do administrador: gestão de toda a plataforma, parceiros, entregadores e entregas.

Use as telas e o código de referência deste documento como base visual. Preserve a identidade neutra e calma. A referência funcional mencionada pelo solicitante é a Del Match, no contexto de logística de entregas; não copie marca, conteúdo ou interface proprietária.

O foco é logística, não um marketplace para consumidores escolherem comida. Não construir uma vitrine de restaurantes nem um sistema de preparo da cozinha como fluxo principal.

Antes de editar, examine o projeto de destino e reutilize sua arquitetura, bibliotecas e convenções. Se houver aplicação existente, integre os módulos a ela. Se o projeto estiver vazio, separe frontend, domínio, persistência e autenticação de modo que as três interfaces usem os mesmos serviços. Não crie três bancos independentes ou três cópias locais do estado das entregas.

Entregue primeiro uma fatia funcional: uma entrega criada pelo estabelecimento, visível no CRM, aceita pelo entregador, coletada e concluída, com os três painéis refletindo o mesmo registro. Depois complete cadastros, CRM e estados de interface.

## 2. Referências já produzidas

| Área | Protótipo publicado | Base de código no anexo |
| --- | --- | --- |
| Estabelecimento | https://mesa-delivery-painel-ti.leonardo-leothebest.chatgpt.site | `estabelecimento/index.html` |
| Entregador | https://mesa-app-entregadores-ti.leonardo-leothebest.chatgpt.site | `entregador/index.html` |
| Administração / CRM | https://mesa-crm-administrador-ti.leonardo-leothebest.chatgpt.site | `crm/index.html`, `crm/style.css`, `crm/app.js` |

Os links são privados e podem exigir acesso do proprietário. O anexo incorpora os arquivos completos para permitir consultar a interface sem depender dos links.

### Estado atual versus implementação solicitada

**Já existente:** três protótipos web responsivos com dados ilustrativos e interações locais: atribuição, aceitação, avanço de etapas, cadastros, aprovação e notas de relacionamento.

**A construir:** backend compartilhado, persistência, login, autorização por perfil, sincronização das interfaces e consistência do fluxo de entregas.

Os protótipos não têm autenticação própria, dados persistentes, GPS ao vivo, pagamento, notificações push ou integração entre si. Seus números, datas, nomes e endereços são exemplos. As validações locais não substituem regras no servidor.

As três interfaces usam identificadores e status ilustrativos independentes. Não importe as listas como se fossem dados integrados: o pedido `#1048` de um protótipo não é automaticamente o mesmo registro no outro.

A marca atual é **Solution Delivery**. Centralize o nome, o símbolo e os tokens para uso nas três áreas. Os endereços publicados ainda contêm `mesa` por continuidade da hospedagem; isso não altera a marca da interface.

## 3. Design system atual — neutros claros e verde suave

Esta versão é a referência visual final: componentes, tipografia e organização do Markdown de identidade **Solution Delivery**, com a paleta anterior adaptada para um tom mais claro. A preferência mais recente do usuário substitui a exigência de botões pretos e de interface estritamente monocromática do documento anterior.

### 3.1 Paleta oficial

| Token | Claro, padrão | Escuro |
| --- | --- | --- |
| `bg` | `#F8F9F5` | `#161C16` |
| `surface` | `#FFFFFF` | `#1E261E` |
| `surface-sunken` | `#EEF2E8` | `#283227` |
| `line` | `#E1E7DA` | `#374335` |
| `line-strong` | `#CDD7C5` | `#4B5946` |
| `ink` | `#303A31` | `#EDF2E8` |
| `ink-muted` | `#626E60` | `#B4BEAE` |
| `ink-subtle` | `#879280` | `#88947F` |
| `action` | `#556A52` | `#C5D6B8` |
| `action-hover` | `#465B45` | `#D7E3CE` |
| `on-action` | `#FFFFFF` | `#1E261E` |
| `accent` | `#5B7252` | `#ACC79C` |
| `accent-soft` | `#EAF1E3` | `#2A3B27` |
| `on-accent` | `#FFFFFF` | `#1E261E` |
| `danger` | `#B42318` | `#F97066` |
| `danger-soft` | `#FCEBE9` | `#2C1513` |
| `warning` | `#8A5300` | `#F2B84B` |
| `warning-soft` | `#FCF1DC` | `#2A1F0B` |

O CSS completo dos tokens está no anexo `shared/tokens.css`.

- Tema inicial claro. Oferecer Claro, Escuro e Sistema; persistir a escolha do usuário.
- Alternar com `data-theme="light|dark"` no elemento `html`.
- Ação principal em verde suave do token `action`, texto em `on-action`.
- Status positivo em `accent` / `accent-soft`; alerta real em `warning`; erro ou ação destrutiva em `danger`.
- Pendência comercial ou aprovação de cadastro usa tons neutros, sem ser tratada como atraso.
- Usar `ink-muted` para texto secundário legível. `ink-subtle` fica para apoio visual, bordas e estado desabilitado.
- Evitar gradientes, cores saturadas, sombras em cards parados e animações chamativas.

Pares principais verificados no tema claro: texto/fundo 11,19:1; texto secundário/superfície 5,36:1; texto/botão principal 5,88:1; texto/status verde 5,28:1; verde/superfície suave 4,58:1. Essas verificações não substituem conferir contraste de componentes novos.

### 3.2 Tipografia

Uma família: **Manrope**, com fallback de sistema. Números, moedas, horários, distâncias e identificadores devem usar `font-variant-numeric: tabular-nums`.

| Estilo | Tamanho / altura | Peso |
| --- | --- | --- |
| Título de página | 32 / 38 px | 700 |
| KPI | 28 / 34 px | 700 |
| Título de painel ou modal | 20 / 28 px | 700 |
| Cabeçalho de coluna / cliente | 15 / 22 px | 700 |
| Corpo | 14 / 20 px | 400 |
| Corpo destacado / botão | 14 / 20 px | 600 |
| Texto menor | 13 / 18 px | 400–600 |
| Rótulo / metadado | 12 / 16 px | 500–600 |

Rótulos de KPI e cabeçalhos de tabela podem ser em caixa alta, espaçamento de letras de 0,04em. Não reduzir texto funcional abaixo de 12 px.

### 3.3 Espaçamento, geometria e profundidade

- Espaços: 4, 8, 12, 16, 24, 32 e 40 px.
- Cards: padding de 16 px; painéis e modais: 24 px.
- Conteúdo administrativo: até 1280 px, centralizado; margem interna desktop de 32 px.
- App do entregador: coluna única de até 560 px, inclusive em desktop.
- Raios: 8 px em campos e itens de menu; 16 px em cards, painéis e modais; pílula em botões, badges, avatares e controles segmentados.
- Cards parados sem sombra. `shadow-float` somente em modal, toast, drawer e elementos flutuantes; `shadow-sm` na opção selecionada do controle segmentado.
- Ícones de traço com espessura 1,5. Preferir a biblioteca já instalada no projeto; preservar o aspecto dos SVGs de referência.

### 3.4 Marca

Símbolo circular com círculo cheio em `ink`, anel em `bg` e ponto central em `accent`. Manter o desenho existente nos arquivos anexos. Ao lado, **Solution** em Manrope 800 e **Delivery** em Manrope 500 / `ink-muted`. Usar o símbolo também no favicon.

### 3.5 Componentes compartilhados

| Componente | Regras |
| --- | --- |
| Botão | Pílula, peso 600; principal `action/on-action`; secundário `surface/line-strong/ink`; hover pelo token correspondente |
| Botão mobile | Altura mínima de 48 px no app do entregador |
| Status | Pílula com ponto cheio ou vazado e rótulo escrito; nunca só cor |
| Campo | Rótulo, altura mínima 40 px, raio 8 px, foco visível e mensagem de erro |
| Controle segmentado | Trilho `surface-sunken`, opção ativa `surface`, pílula e sombra mínima |
| KPI | Superfície branca/clara, borda leve, rótulo, valor tabular e contexto |
| Card de entrega | Número, status, cliente, coleta/destino, entregador, valor e ação contextual |
| Tabela | Cabeçalho legível, divisores leves, hover `surface-sunken`, valores numéricos alinhados à direita |
| Modal | Superfície, raio 16 px, padding 24 px, sombra flutuante, foco controlado e fechamento por Escape |
| Navegação | Sidebar de 248 px no desktop, item ativo em `action/on-action`, drawer abaixo de 1024 px |
| Avatar | Circular, iniciais em fundo neutro |
| Toast | Pílula em `action/on-action`, centralizado abaixo e com anúncio acessível |
| Estado vazio | Ícone, título, explicação curta e ação útil, centralizados |

Usar no máximo uma ação principal por card, painel ou formulário. Destruição exige confirmação. Desabilitação precisa ser reconhecível e não depender apenas de cor.

### 3.6 Responsividade e acessibilidade

- Desktop: quadros e tabelas com boa densidade, espaços constantes e conteúdo centralizado.
- Abaixo de 1024 px: navegação em drawer; quadros se reorganizam sem recortar conteúdo.
- Abaixo de 640 px: cards empilhados e áreas de toque maiores.
- Tabelas podem rolar dentro do próprio contêiner; evitar rolagem horizontal da página inteira.
- Foco de teclado visível, rótulos em campos e botões de ícone, status com texto e diálogos acessíveis.
- Respeitar `prefers-reduced-motion` e ampliação do texto.
- Moedas em BRL, distância em km, datas e horários em pt-BR.

## 4. Perfis e permissões

| Capacidade | Administrador | Estabelecimento | Entregador |
| --- | --- | --- | --- |
| Ver operação | Todos os parceiros da plataforma autorizada | Apenas seu estabelecimento | Apenas ofertas elegíveis e suas entregas |
| Cadastrar estabelecimento | Sim | Não | Não |
| Alterar etapa comercial e notas CRM | Sim | Não | Não |
| Aprovar / pausar entregador | Sim | Não | Não |
| Criar solicitação de entrega | Sim, para parceiro autorizado | Sim, para sua loja | Não |
| Atribuir entregador | Sim | Sim, para sua loja e rede elegível | Não |
| Aceitar / recusar oferta | Não em nome do entregador | Não em nome do entregador | Sim, para ofertas elegíveis |
| Confirmar chegada à coleta | Correção administrativa auditada | Consultar | Sim, em sua entrega |
| Confirmar retirada | Correção administrativa auditada | Sim, em sua entrega | Sim, em sua entrega |
| Confirmar conclusão | Correção administrativa auditada | Consultar | Sim, em sua entrega |
| Consultar histórico | Operação autorizada | Entregas de sua loja | Suas entregas |

O administrador pertence à plataforma, não a uma loja. O perfil estabelecimento fica vinculado a um `establishment_id`. O perfil entregador fica vinculado a um `courier_id`.

Aplicar essas permissões no servidor em todas as consultas e mutações. Esconder um botão não é uma autorização. Um usuário não pode trocar um ID na requisição e acessar dados de outro parceiro ou entregador.

Não acrescentar perfis de cliente final, financeiro ou suporte no primeiro escopo.

## 5. Área do estabelecimento

### Tela principal: Gestão de entregas

- Nome do estabelecimento e identidade do operador.
- Controle de operação ativa / pausada.
- Indicadores derivados dos dados: entregas em andamento, concluídas no período, valor dos fretes ativos e prazo estimado quando houver fonte para ele.
- Busca por número de entrega ou cliente.
- Abas de andamento e concluídas.
- Quadro em três colunas: aguardando entregador, em coleta e em rota.
- Cards com número, destinatário, destino, distância quando calculada, entregador, frete e ação contextual.
- Diálogo de detalhes com origem, destino, observações e histórico de etapas.

### Ações

1. Criar solicitação de entrega com cliente, destino, observações e coleta vinculada à loja. Essa entrada é necessária na aplicação integrada; não está no primeiro protótipo.
2. Atribuir a um entregador elegível ou deixar a solicitação disponível para aceitação.
3. Acompanhar o aceite e a chegada do entregador.
4. Confirmar retirada quando o pedido for entregue ao entregador.
5. Consultar conclusão e histórico.

A pausa do estabelecimento impede novas solicitações/ofertas da loja, mas preserva o andamento das entregas já atribuídas. A ação deve explicar esse efeito antes da confirmação.

Na tela do estabelecimento, conclusão é leitura do evento vindo do entregador. O botão demonstrativo `Confirmar entrega` do primeiro protótipo deve ser substituído por acompanhamento, conforme a matriz de permissões.

Não exibir previsão fixa de 25 minutos como se fosse calculada. Usar estimativa configurada com rótulo explícito ou mostrar que não há previsão disponível.

## 6. App web do entregador

Prioridade de layout: celular. O escopo inicial é um app web responsivo; publicação em lojas e recursos nativos ficam para outra etapa.

### Disponibilidade

- Estado disponível / indisponível.
- Cadastro pendente ou pausado não pode ficar disponível.
- Com uma entrega atribuída ou aceita, mostrar a atividade em andamento e impedir aceitar outra.
- Restaurar a entrega ativa ao voltar ao app ou recarregar a página.

### Aba Ofertas

Cada oferta mostra:

- Identificador da entrega.
- Valor **que o entregador recebe**, com destaque.
- Distância do percurso e tempo estimado, quando disponíveis.
- Distância até a coleta, quando houver dados de localização.
- Estabelecimento e endereço de coleta.
- Região de destino e dados necessários para decidir o aceite.
- Situação de prontidão da coleta, se informada pela loja.
- Botões aceitar e recusar.

A oferta pública deve expor apenas os dados necessários ao aceite; dados pessoais completos do destinatário ficam disponíveis após a atribuição/aceitação ao entregador autorizado.

Ao aceitar, abrir confirmação com valor e percurso. Só apresentar sucesso depois da resposta do servidor. Se outro entregador tiver aceitado antes, retirar a oferta e informar que ela não está mais disponível.

Recusa é por entregador: recusar não cancela a entrega para a plataforma e não remove a oferta para todos.

### Aba Minha entrega

1. **Aceita:** mostrar coleta e ação `Cheguei ao restaurante`.
2. **Na coleta:** mostrar identificador, instruções e ação `Confirmar retirada`.
3. **Em rota:** mostrar destino, observações e ação `Confirmar entrega`.
4. **Concluída:** registrar a entrega e liberar o entregador.

Disponibilizar `Abrir endereço no Maps` para o endereço da etapa atual. Esse link é navegação externa; não representa rastreamento GPS ao vivo.

### Aba Concluídas

- Histórico de entregas do entregador.
- Número, estabelecimento, data/hora e valor do frete recebido previsto.
- Somatório por período.
- Não chamar esse somatório de saldo disponível ou pagamento realizado: pagamentos e repasses não foram implementados.

### Estados de interface

Indisponível, cadastro aguardando aprovação, conta pausada, sem ofertas, oferta indisponível, entrega ativa, sem histórico, carregando, erro de rede e reconexão.

## 7. CRM do administrador

### 7.1 Visão geral

- Estabelecimentos ativos e total cadastrado.
- Entregadores disponíveis, em entrega e aguardando aprovação.
- Entregas em andamento e aguardando atribuição.
- Somatório de fretes concluídos no período, sem tratá-lo como receita líquida da plataforma.
- Distribuição de entregas por etapa.
- Pendências de aprovação e implantação.
- Lista das entregas ativas, com acesso aos detalhes.

Os indicadores devem vir dos mesmos dados que alimentam as listas. Informar o período aplicado e atualizar após cada mudança.

### 7.2 Estabelecimentos / relacionamento

- Listagem com nome, cidade, responsável, contato, canal de aquisição e etapa comercial.
- Busca e filtro por etapa.
- Cadastro de novo estabelecimento como prospect.
- Resumo das etapas: prospect, implantação e parceiro ativo.
- Perfil com dados de contato e endereço de coleta.
- Alteração da etapa do relacionamento.
- Histórico de anotações com autor e data/hora reais.
- Inclusão de nota de contato ou próximo passo.

Etapas: `lead`, `onboarding`, `active`, `paused`.

Separar a etapa comercial da disponibilidade operacional. Um parceiro ativo pode pausar temporariamente a operação sem voltar à etapa de prospect ou ter o cadastro suspenso.

### 7.3 Entregadores

- Listagem com nome, telefone, veículo, aprovação e disponibilidade.
- Busca e filtros.
- Cadastro para aprovação.
- Perfil com entregas em andamento e concluídas.
- Aprovar cadastro, pausar e reativar.
- Impedir pausa enquanto houver uma entrega atribuída/ativa, no escopo inicial.

Separar aprovação (`pending`, `approved`, `paused`) de disponibilidade (`offline`, `available`, `busy`). Nos protótipos esses conceitos aparecem em um único campo; na implementação real devem ser distintos.

A aprovação administrativa inicial é de cadastro. Não simular análise automática de documentos ou verificação de identidade.

### 7.4 Central de entregas

- Lista global de entregas com estabelecimento, cliente, entregador, status e frete.
- Busca por número, estabelecimento, cliente ou entregador.
- Filtro por etapa.
- Detalhes com coleta, destino, distância e histórico.
- Atribuição a entregador elegível e disponível.
- Acompanhamento das transições.
- Correções administrativas devem registrar operador, motivo e alteração, sem apagar o histórico anterior.

As etapas comerciais, pausas e novas notas CRM não precisam aparecer no app do entregador. O que se sincroniza é o dado relevante à operação e permitido para cada perfil.

## 8. Fluxo integrado e status canônicos

Esta seção é a proposta de implementação integrada. Ela resolve diferenças entre os três protótipos e é a fonte de verdade para o backend.

### Estados da entrega

| Código | Rótulo | Significado |
| --- | --- | --- |
| `waiting` | Aguardando entregador | Sem vínculo com entregador; elegível para oferta ou atribuição |
| `assigned` | Aguardando aceite | Oferta dirigida a um entregador pela central/loja |
| `accepted` | Entrega aceita | Entregador confirmou o vínculo e segue para coleta |
| `arrived` | Na coleta | Chegada ao estabelecimento confirmada |
| `collected` | Em rota | Pedido retirado; transporte até o destinatário |
| `delivered` | Entregue | Entrega concluída |

Fluxo por oferta aberta:

`waiting → accepted → arrived → collected → delivered`

Fluxo por atribuição manual:

`waiting → assigned → accepted → arrived → collected → delivered`

A atribuição manual não deve registrar o aceite silenciosamente pelo entregador. Ela direciona a solicitação ao app, onde o entregador aceita ou recusa. Recusar uma atribuição dirigida devolve a entrega a `waiting` e libera a reserva do entregador.

### Agrupamento visual do estabelecimento

| Coluna / aba | Estados incluídos |
| --- | --- |
| Aguardando entregador | `waiting`, `assigned` — com rótulos distintos |
| Em coleta | `accepted`, `arrived` |
| Em rota | `collected` |
| Concluídas | `delivered` |

### Mapeamento dos protótipos

| Área | Representação atual | Aplicação integrada |
| --- | --- | --- |
| Estabelecimento | `stage` numérico 0, 1, 2, 3 | Usar estados canônicos e o agrupamento acima |
| Entregador | `accepted`, `arrived`, `collected`, `delivered` | Preservar os nomes e conectar ao backend |
| CRM | `waiting`, `collecting`, `route`, `delivered` | `collecting` se desdobra em `assigned` / `accepted` / `arrived`; `route` vira `collected` |

### Exemplo ponta a ponta

1. Parceiro ativo cria a entrega `#1048` para Marina, com endereço de destino e coleta da loja.
2. O backend grava `waiting`; estabelecimento e CRM passam a mostrar o mesmo registro.
3. Bruno, aprovado e disponível, vê a oferta e confirma o aceite.
4. O backend vincula Bruno, registra `accepted` e o torna ocupado na mesma transação.
5. Outros entregadores deixam de receber essa oferta.
6. Bruno confirma chegada; os painéis mostram `arrived` em coleta.
7. A retirada é confirmada; o registro passa a `collected`, exibido em rota.
8. Bruno confirma entrega; o registro passa a `delivered` e libera sua disponibilidade.
9. Histórico e indicadores das três áreas são recalculados a partir desses dados.

## 9. Regras de consistência

- Uma entrega tem um único estabelecimento de origem.
- No MVP, cada entrega tem uma coleta e um destino.
- Um entregador pode ter no máximo uma entrega reservada/ativa: `assigned`, `accepted`, `arrived` ou `collected`.
- Aceitação e atribuição devem ser atômicas no banco; duas requisições concorrentes não podem vincular a mesma entrega a pessoas diferentes.
- A reserva manual também precisa bloquear outra atribuição incompatível ao entregador.
- Em repetição da mesma requisição, retornar o resultado já registrado ou um conflito claro; não criar um segundo evento operacional.
- Aplicar transições explícitas; não concluir uma entrega que ainda não foi coletada.
- Confirmar retirada pelo estabelecimento e pelo entregador deve produzir um único evento efetivo.
- Entrega concluída não pode voltar para ativa por uma ação comum.
- Recusa não é cancelamento.
- Oferta dirigida só pode ser aceita pelo entregador indicado.
- Cada mudança deve persistir estado, vínculo e evento no mesmo limite transacional.
- Só atualizar a interface como concluída/aceita depois de confirmação do servidor.
- Na reconexão, recarregar o estado autorizado do servidor; não sobrescrever dados com o estado antigo do navegador.
- Usar valores monetários em centavos inteiros; formatar como BRL na interface.
- Diferenciar taxa cobrada do estabelecimento de remuneração do entregador, mesmo que sejam iguais nos exemplos.
- Usar datas reais do servidor e exibir em `America/Sao_Paulo`; não manter as datas fixas dos protótipos.
- Distâncias e previsões ausentes devem aparecer como indisponíveis, sem valores inventados.

Expiração de ofertas, cancelamento, reatribuição de entrega ativa e múltiplas entregas simultâneas precisam de políticas próprias. Não implementar comportamentos silenciosos para esses casos no primeiro MVP; deixá-los fora da ação comum até as políticas serem definidas.

## 10. Modelo de dados proposto

Adaptar os nomes à arquitetura existente, mantendo as relações e responsabilidades.

| Entidade | Campos principais |
| --- | --- |
| `User` | id, nome, e-mail, identidade de autenticação, perfil, establishment_id ou courier_id, ativo, created_at |
| `Establishment` | id, nome, responsável, telefone, e-mail, cidade, endereço de coleta, canal de aquisição, lifecycle_status, operation_open, created_at |
| `Courier` | id, user_id, nome, telefone, veículo, approval_status, availability_status, created_at |
| `Delivery` | id, código legível, establishment_id, courier_id opcional, status, cliente, contato, endereço de coleta preservado, endereço de destino, observações, pickup_ready, distance_m opcional, eta_minutes opcional, fee_cents, courier_payout_cents, version, created_at, updated_at |
| `DeliveryOffer` | id, delivery_id, courier_id, status (`pending`, `accepted`, `declined`, `withdrawn`), origem (`open` ou `manual`), created_at, responded_at |
| `DeliveryEvent` | id, delivery_id, estado anterior, estado novo, actor_user_id, origem da ação, motivo opcional, timestamp |
| `CRMNote` | id, establishment_id, author_user_id, texto, created_at |
| `AuditEvent` | id, actor_user_id, entidade, entity_id, ação, alteração, motivo opcional, timestamp |

Endereços da entrega devem preservar a informação usada na solicitação; editar o endereço cadastral de uma loja não deve alterar silenciosamente o histórico de entregas antigas.

A relação `DeliveryOffer` permite registrar a recusa de um entregador sem cancelar o pedido. Uma oferta dirigida e as ofertas abertas devem convergir para a mesma `Delivery`.

Índices e restrições devem cobrir código único, consultas por estabelecimento/status, entregador/status, histórico por entrega e unicidade de entrega reservada/ativa por entregador. Usar restrições no banco ou bloqueios transacionais adequados à tecnologia existente.

## 11. Contratos de serviço propostos

Os caminhos abaixo são exemplos; adaptar ao padrão do projeto. Todas as operações exigem autenticação e escopo por perfil.

| Operação | Exemplo de endpoint | Resultado |
| --- | --- | --- |
| Identificar sessão | `GET /api/me` | Perfil e vínculos autorizados |
| Listar estabelecimentos | `GET /api/establishments` | CRM ou cadastro autorizado |
| Cadastrar estabelecimento | `POST /api/establishments` | Novo prospect |
| Atualizar parceiro | `PATCH /api/establishments/:id` | Dados/etapa conforme permissão |
| Registrar nota | `POST /api/establishments/:id/notes` | Histórico persistente |
| Listar entregadores | `GET /api/couriers` | Rede elegível ou visão administrativa |
| Cadastrar entregador | `POST /api/couriers` | Cadastro pendente |
| Aprovar / pausar | `POST /api/couriers/:id/approval-actions` | Novo estado de aprovação |
| Alterar disponibilidade | `PATCH /api/couriers/me/availability` | Disponibilidade válida |
| Criar entrega | `POST /api/deliveries` | Registro `waiting` |
| Listar entregas | `GET /api/deliveries` | Lista limitada ao perfil |
| Consultar entrega | `GET /api/deliveries/:id` | Detalhes e etapas autorizadas |
| Listar ofertas | `GET /api/couriers/me/offers` | Ofertas elegíveis |
| Atribuir entrega | `POST /api/deliveries/:id/assign` | Reserva manual `assigned` |
| Aceitar oferta | `POST /api/deliveries/:id/accept` | Vínculo confirmado `accepted` |
| Recusar oferta | `POST /api/deliveries/:id/decline` | Recusa individual registrada |
| Confirmar chegada | `POST /api/deliveries/:id/arrive` | Estado `arrived` |
| Confirmar retirada | `POST /api/deliveries/:id/collect` | Estado `collected` |
| Confirmar entrega | `POST /api/deliveries/:id/complete` | Estado `delivered` |
| Consultar indicadores | `GET /api/dashboard` | Indicadores por perfil e período |

Paginar listas, validar campos no servidor e retornar erros específicos de acesso, registro inexistente, conflito de aceite, entregador ocupado e transição inválida. Requisições de mutação devem ter proteção contra repetição e checagem da versão atual quando necessário.

Sincronizar mudanças usando o mecanismo já disponível no projeto. Se não existir infraestrutura em tempo real, iniciar com atualização periódica e atualização após ações; informar o estado de conexão e recuperar o estado ao reconectar. Não dizer que há rastreamento ao vivo quando há apenas atualização de status.

## 12. Organização sugerida das interfaces

| Área | Rotas sugeridas |
| --- | --- |
| Login | `/login` |
| Estabelecimento | `/estabelecimento/entregas` |
| Entregador | `/entregador/ofertas`, `/entregador/entrega`, `/entregador/concluidas` |
| CRM | `/admin`, `/admin/estabelecimentos`, `/admin/entregadores`, `/admin/entregas` |

Compartilhar tokens visuais, componentes de status, formatadores de moeda/data, validações de formulário e clientes de serviço. Centralizar transições no domínio/backend; evitar regras divergentes em cada tela.

Separar dados demonstrativos em seed ou fixtures. Não colocar nomes, telefones, contagens e datas fixas no código de produção.

## 13. Sequência de implementação

1. Inspecionar o projeto de destino e preservar sua stack.
2. Criar ou adaptar modelos e migrações, autenticação e vínculos de perfil.
3. Implementar serviços de entrega, estados canônicos, autorização e regras atômicas.
4. Implementar criação pelo estabelecimento e aceite pelo entregador.
5. Conectar chegada, retirada, conclusão e sincronização nos três módulos.
6. Conectar cadastros de parceiros e entregadores, aprovação e notas CRM.
7. Aplicar o visual dos protótipos com componentes compartilhados e responsividade.
8. Implementar carregamento, vazio, erros, conflitos e reconexão.
9. Executar verificações de negócio e o fluxo completo com sessões separadas por perfil.
10. Entregar instruções de execução, variáveis necessárias e limitações reais.

Não afirmar que existe uma integração quando o comportamento ainda depende de listas locais. Na ausência de conexão/backend, nomear o modo como demonstração.

## 14. Critérios de aceitação

- [ ] As três interfaces usam o mesmo registro de entrega no banco.
- [ ] Cada usuário só consegue acessar os dados autorizados para seu perfil.
- [ ] O estabelecimento cria a solicitação e ela aparece no CRM.
- [ ] Entregador pendente, pausado ou indisponível não aceita ofertas.
- [ ] Uma atribuição manual pede aceite ao entregador indicado.
- [ ] Dois aceites simultâneos resultam em um único entregador vinculado.
- [ ] Um entregador não fica vinculado a duas entregas reservadas/ativas.
- [ ] Recusa não cancela a entrega nem remove ofertas para outros entregadores.
- [ ] Chegada, retirada e conclusão seguem a ordem definida.
- [ ] A confirmação repetida de retirada não duplica evento ou frete.
- [ ] A conclusão libera o entregador e atualiza indicadores e histórico.
- [ ] Recarregar a página preserva dados e entrega ativa.
- [ ] Busca, filtros, cadastros e notas funcionam com persistência.
- [ ] Notas e dados cadastrados são renderizados como texto seguro.
- [ ] Interfaces são utilizáveis em celular, desktop e teclado.
- [ ] As três áreas compartilham Manrope, tokens, componentes e a paleta clara deste documento.
- [ ] Tema claro é o padrão; escuro e sistema continuam disponíveis.
- [ ] App do entregador mantém coluna única até 560 px e botões de 48 px.
- [ ] Cards parados não têm sombra; status têm ponto e texto.
- [ ] Erros de rede não produzem sucesso falso ou alterações perdidas silenciosamente.
- [ ] Valores de frete não são apresentados como pagamento realizado.
- [ ] Dados de demonstração estão separados dos dados reais.

## 15. Fora do primeiro escopo

App nativo, publicação em lojas, GPS contínuo, mapa em tempo real, roteirização automática, despacho por proximidade, notificações push, pagamentos Pix, repasses, emissão fiscal, integrações com marketplaces, upload de documentos e verificação de identidade não fazem parte dos protótipos atuais.

A operação pode começar com ofertas por região cadastrada, atribuição manual e abertura do endereço em navegador de mapas. Não apresentar distância até o entregador como calculada sem uma fonte de localização.

## 16. Como usar este arquivo no Codex

1. Coloque este Markdown no repositório da aplicação ou anexe ao chat do projeto.
2. Envie: **“Implemente a Solution Delivery conforme este documento. Comece examinando o projeto e desenvolva o fluxo integrado de estabelecimento, entregador e CRM, usando a paleta clara e os códigos de referência do anexo.”**
3. O Codex deve adaptar a implementação ao projeto existente e realizar as mudanças, não apenas escrever um plano.
4. Antes de configurar serviços externos, deve identificar quais acessos são realmente necessários. Segredos ficam em variáveis de ambiente e nunca nos arquivos de referência.
5. Ao concluir uma etapa, apresentar o que funciona, as verificações realizadas e as limitações restantes.

## 17. Anexo — Fontes atuais das três interfaces

Este anexo contém o código completo das versões atuais com **Solution Delivery**, tema claro e verde suave. É autocontido: nenhuma etapa exige o acesso aos sites privados.

Os arquivos são protótipos de interface. Para produção, substituir o estado local por serviços autenticados e persistentes, seguindo o fluxo canônico deste documento. Não copiar estados numéricos, datas fixas ou inconsistências de mock para o domínio do backend.

Os três arquivos de tema são iguais entre os protótipos e foram consolidados em `shared/`. Nos HTMLs abaixo, apenas os caminhos para `tokens.css`, `identity.css` e `theme.js` foram adaptados para `../shared/`. As funcionalidades permanecem as mesmas. Os seletores `data-app` precisam ser preservados ao consultar os estilos, ou substituídos por escopo de componentes na aplicação final.

Estrutura para extrair e consultar os protótipos:

```text
referencias/
  shared/
    tokens.css
    identity.css
    theme.js
  estabelecimento/
    index.html
    layout.css
  entregador/
    index.html
    layout.css
  crm/
    index.html
    style.css
    app.js
```

Sirva a pasta `referencias/` por um servidor HTTP local para consultar as telas. Na aplicação real, reutilize os estilos e componentes conforme a arquitetura do projeto, sem manter três conjuntos duplicados de regras de negócio.

### Arquivo `shared/tokens.css`

```css
@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap");

:root,
[data-theme="light"] {
  --bg: #f8f9f5;
  --surface: #ffffff;
  --surface-sunken: #eef2e8;
  --line: #e1e7da;
  --line-strong: #cdd7c5;
  --ink: #303a31;
  --ink-muted: #626e60;
  --ink-subtle: #879280;
  --action: #556a52;
  --on-action: #ffffff;
  --accent: #5b7252;
  --accent-soft: #eaf1e3;
  --on-accent: #ffffff;
  --danger: #b42318;
  --danger-soft: #fcebe9;
  --warning: #8a5300;
  --warning-soft: #fcf1dc;

  --shadow-sm: 0 1px 2px #1111130f;
  --shadow-float: 0 2px 6px #1111130a, 0 12px 32px -4px #1111131f;
  --focus-ring: 0 0 0 2px #f8f9f5, 0 0 0 4px #556a52;
  --action-hover: #465b45;
}

[data-theme="dark"] {
  --bg: #161c16;
  --surface: #1e261e;
  --surface-sunken: #283227;
  --line: #374335;
  --line-strong: #4b5946;
  --ink: #edf2e8;
  --ink-muted: #b4beae;
  --ink-subtle: #88947f;
  --action: #c5d6b8;
  --on-action: #1e261e;
  --accent: #acc79c;
  --accent-soft: #2a3b27;
  --on-accent: #1e261e;
  --danger: #f97066;
  --danger-soft: #2c1513;
  --warning: #f2b84b;
  --warning-soft: #2a1f0b;

  --shadow-sm: 0 1px 2px #00000080;
  --shadow-float: 0 12px 32px -4px #000000cc;
  --focus-ring: 0 0 0 2px #161c16, 0 0 0 4px #c5d6b8;
  --action-hover: #d7e3ce;
}

:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  --radius-sm: 8px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  --font-sans: "Manrope", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

html { color-scheme: light dark; }
body {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 20px;
  background: var(--bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
.tabular { font-variant-numeric: tabular-nums; }
:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
:root{--paper:var(--surface);--muted:var(--ink-muted);--green:var(--action);--soft:var(--surface-sunken);--sand:var(--surface-sunken);--font-display:32px;--font-kpi:28px;--font-title:20px;--font-heading:15px;--font-body:14px;--font-sm:13px;--font-caption:12px;--overlay:#00000066}
```

### Arquivo `shared/identity.css`

```css
html[data-theme=light]{color-scheme:light}html[data-theme=dark]{color-scheme:dark}body{font-family:var(--font-sans);font-size:var(--font-body);line-height:20px;font-variant-numeric:tabular-nums;background:var(--bg);color:var(--ink)}button,input,select,textarea{font-family:var(--font-sans)}button,a,input,select,textarea{transition:color 150ms,background-color 150ms,border-color 150ms}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid transparent;box-shadow:var(--focus-ring)}svg{stroke-width:1.5}.brand{letter-spacing:-.01em;gap:10px;line-height:20px;align-items:center}.brand .solution-mark{width:28px;height:28px;flex-shrink:0}.brand .brand-name{font-size:15px;font-weight:500;white-space:nowrap;display:block!important}.brand-name strong{font-weight:800;color:var(--ink)}.brand-name>span{font-weight:500;color:var(--ink-muted)}.brand .brand-name small{font-size:12px;line-height:16px;letter-spacing:.04em;margin:4px 0 0;font-weight:500;color:var(--ink-muted)}.brand .brand-name span{display:inline}.workspace{max-width:1280px;padding:32px;margin:auto}h1{font-size:32px;line-height:38px;letter-spacing:-.02em;font-weight:700}h2,dialog h2,.dialog-top h2,.next h2{font-size:20px;line-height:28px;letter-spacing:-.01em;font-weight:700}.eyebrow,.label,.nav-label,.navlabel{font-size:12px;line-height:16px;font-weight:600;letter-spacing:.04em;color:var(--ink-muted)}.subtitle,.sub,.address,.delivery,.items,.sidebar-note,.fine,.foot,footer,.read-only,.dialog-note,.pipeline-note,.result-count,.metric small,.metric label{color:var(--ink-muted)}.subtitle,.sub,.address,.items{font-size:14px;line-height:20px}.button,button.primary,.primary,.secondary{border-radius:var(--radius-full);min-height:40px;padding:8px 16px;font-size:14px;font-weight:600;line-height:20px;gap:8px}.primary,.nav-button.active,.nav{background:var(--action);color:var(--on-action);border-color:var(--action)}.primary:hover{background:var(--action-hover);border-color:var(--action-hover)}.secondary,.button:not(.primary),.store{background:var(--surface);color:var(--ink);border-color:var(--line-strong)}.secondary:hover,.button:not(.primary):hover{background:var(--surface-sunken)}.small{min-height:32px;font-size:13px;line-height:18px;padding:4px 12px}.icon-button,.menu-toggle{border-radius:var(--radius-full);border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);width:40px;height:40px;display:grid;place-items:center;padding:8px}.menu-toggle{display:none}.appearance{display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:auto}.theme-label{font-size:12px;color:var(--ink-muted)}.appearance select{font-size:13px;line-height:18px;color:var(--ink);border:1px solid var(--line-strong);background:var(--surface);border-radius:var(--radius-full);padding:8px 12px;min-height:40px}.appearance select:hover{background:var(--surface-sunken)}header,.topbar{gap:16px;flex-wrap:wrap;background:var(--surface);padding:24px 32px;border-color:var(--line)}.demo,.date{font-size:12px;line-height:16px;color:var(--ink-muted);background:var(--surface-sunken);border-color:var(--line);border-radius:var(--radius-full);padding:8px 12px}.metric,.metric:first-child,.card,.offer,.panel,.next,.active-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);box-shadow:none}.metric{padding:16px 24px 16px 16px}.metric:first-child small{color:var(--ink-muted)}.metric label{font-size:12px;line-height:16px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}.value,.metric .value,.amount{font-size:28px;line-height:34px;letter-spacing:-.02em;font-weight:700}.metric small{font-size:12px;line-height:16px}.card:hover{transform:none;box-shadow:none;border-color:var(--line-strong)}.card{padding:16px;margin-bottom:16px}.card-top{gap:8px;flex-wrap:wrap}.customer,.order-id,.stop strong,.column-head{font-size:15px;line-height:22px;font-weight:700}.order-id{font-size:12px;line-height:16px;color:var(--ink-muted);font-weight:600}.card .items{border-color:var(--line);padding-top:12px;margin-top:16px;line-height:22px}.card .items b{color:var(--ink-muted)}.card .note,.active-note,.note-item,.pickup-note,.payment,.tag,.time{background:var(--surface-sunken);color:var(--ink-muted);border-color:var(--line);border-radius:var(--radius-sm)}.payment,.time,.tag{border-radius:var(--radius-full)}.price{font-size:14px;font-weight:700}.card-bottom{border-top:1px solid var(--line);padding-top:12px;margin:16px 0}.tabs{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border:0;border-radius:var(--radius-full);background:var(--surface-sunken);width:auto;max-width:100%}.tab{display:flex;align-items:center;justify-content:center;gap:8px;min-height:32px;padding:4px 14px;color:var(--ink-muted);font-size:13px;line-height:18px;font-weight:600;border:0;border-radius:var(--radius-full);background:transparent}.tab.active{border:0;color:var(--ink);background:var(--surface);box-shadow:var(--shadow-sm)}.tab span,.badge,.nav b{color:inherit;font-size:12px;line-height:16px;background:transparent;padding:0;font-weight:500}.tab span{margin:0}.search{background:var(--surface-sunken);border:1px solid var(--line);border-radius:var(--radius-sm);padding:8px 12px;min-height:40px}.search input{background:transparent;color:var(--ink);font-size:14px;line-height:20px;min-width:0}.search input::placeholder{color:var(--ink-muted)}.search:focus-within{border-color:var(--ink);box-shadow:var(--focus-ring)}.search input:focus-visible{box-shadow:none;outline:2px solid transparent}.field input,.field select,.field textarea,.filter,#courier{background:var(--surface)!important;color:var(--ink);border:1px solid var(--ink-subtle)!important;border-radius:var(--radius-sm)!important;min-height:40px;padding:8px 12px!important;font-size:14px;line-height:20px}.field{font-size:13px;font-weight:600}.field textarea{font-weight:400}.field input::placeholder,.field textarea::placeholder{color:var(--ink-muted)}.avatar{background:var(--surface-sunken);color:var(--ink);border-radius:var(--radius-full);width:36px;height:36px;font-size:12px;font-weight:700}.status{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:24px;padding:4px 10px;border:1px solid transparent;border-radius:var(--radius-full);font-size:12px;line-height:16px;font-weight:600;background:var(--surface-sunken);color:var(--ink-muted);white-space:nowrap}.status:before{content:'';display:inline-block;width:6px;height:6px;flex-shrink:0;border:1.5px solid currentColor;border-radius:var(--radius-full);background:transparent}.status.s-available,.status.s-active,.status.s-delivered,.status.status-3{background:var(--accent-soft);color:var(--accent)}.status.s-route,.status.status-2{background:var(--accent);color:var(--on-accent)}.status.s-available:before,.status.s-active:before,.status.s-delivered:before,.status.s-route:before,.status.status-2:before,.status.status-3:before{background:currentColor}.status.status-0,.status.s-waiting{background:var(--surface);color:var(--ink);border-color:var(--ink)}.status.s-pending,.status.s-onboarding,.status.pending,.status.paused,.status.neutral{background:var(--surface-sunken);color:var(--ink-muted)}.column-head span{background:var(--surface-sunken);color:var(--ink);border-radius:var(--radius-full)}.col-title i,.column:nth-child(2) i{background:var(--ink-muted)}.column:nth-child(3) i{background:var(--accent)}.store{border-radius:var(--radius-full);font-size:13px}.store .dot,.statusdot{background:var(--accent)}.store.closed .dot,.availability.offline .statusdot{background:transparent;border:1.5px solid var(--ink-subtle)}dialog{background:var(--surface);color:var(--ink);border-color:var(--line);border-radius:var(--radius-lg);padding:24px;box-shadow:var(--shadow-float)}dialog::backdrop{background:var(--overlay)}.toast,#toast{background:var(--action);color:var(--on-action);border-radius:var(--radius-full);padding:12px 16px;box-shadow:var(--shadow-float);font-size:14px;line-height:20px}table th{background:var(--surface);border-bottom:1px solid var(--line-strong);font-size:12px;line-height:16px;color:var(--ink-muted);font-weight:600;letter-spacing:.04em}table td{font-size:14px;line-height:20px;color:var(--ink);border-color:var(--line)}table tbody tr:hover{background:var(--surface-sunken)}table td small{font-size:12px;line-height:16px;color:var(--ink-muted)}table td strong{font-weight:600}.panel-heading,.panel-body{padding:24px}.panel-heading{border-color:var(--line)}.quiet-link{font-size:13px;line-height:18px;color:var(--ink);border-radius:var(--radius-full);padding:4px 12px}.quiet-link:hover{background:var(--surface-sunken)}.pipeline-box{background:var(--surface-sunken);border-radius:var(--radius-sm);padding:16px}.pipeline-box strong{font-size:28px;line-height:34px;font-weight:700}.pipeline-box span{font-size:12px;line-height:16px;color:var(--ink-muted)}.pipeline-line,.pipeline-box:nth-child(2) .pipeline-line{background:var(--ink-muted)}.pipeline-box:nth-child(3) .pipeline-line,.pipeline-box:nth-child(4) .pipeline-line{background:var(--accent)}.pending-row{border-color:var(--line);padding:16px 0}.pending-row strong{font-size:14px;line-height:20px}.crm-stage{padding:16px;background:var(--surface);border-color:var(--line);border-radius:var(--radius-lg)}.crm-stage strong{font-size:28px;line-height:34px}.danger{color:var(--danger)!important;background:var(--surface)!important;border-color:var(--line-strong)!important}.danger:hover{background:var(--danger-soft)!important}.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:180px;text-align:center;background:var(--surface);border-color:var(--line);border-radius:var(--radius-lg);padding:32px}.empty-icon{background:var(--surface-sunken);color:var(--ink);border-radius:var(--radius-full)}.empty-icon svg{width:24px;height:24px}.empty p{font-size:14px;line-height:20px;color:var(--ink-muted)}.active-top,.finished-total{background:var(--surface);border-color:var(--line)}.active-top{border-bottom:1px solid var(--line);padding:24px}.active-top .label{color:var(--ink-muted)}.active-top h2{font-size:20px;line-height:28px}.stepper{padding:24px 24px 8px}.step{font-size:12px;line-height:16px;color:var(--ink-muted)}.step:before{background:var(--line)}.step.reached{color:var(--ink)}.step.reached:before{background:var(--ink)}.next{padding:24px}.order-summary{border-color:var(--line);font-size:14px;line-height:20px}.confirm-summary{background:var(--surface-sunken)!important;color:var(--ink);border-radius:var(--radius-sm)!important}.finished-total{border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px}.pin{border-color:var(--ink-muted);background:var(--surface)}.stop:last-child .pin{border-color:var(--ink);background:var(--surface-sunken);border-radius:var(--radius-full)}.stop:first-child:after{background:var(--line)}.drawer-overlay{position:fixed;inset:0;border:0;background:var(--overlay);z-index:19;padding:0}.sidebar-note{display:none}button:disabled{opacity:.45;cursor:not-allowed}.foot{color:var(--ink-muted)}
html[data-app=mesa] aside,html[data-app=mesa-crm] aside{width:248px;padding:24px 16px;z-index:20;background:var(--surface);border-color:var(--line)}html[data-app=mesa] main,html[data-app=mesa-crm] main{margin-left:248px}.nav-button{height:40px;border-radius:var(--radius-sm);padding:8px 12px;font-size:14px;font-weight:600;color:var(--ink-muted)}.nav-button:hover{background:var(--surface-sunken)}.nav-button.active{background:var(--action);color:var(--on-action)}.nav-button .badge{background:transparent;color:inherit;padding:0;font-size:12px}.nav{height:40px;border-radius:var(--radius-sm);padding:8px 12px;margin-top:0}.navlabel,.nav-label{margin:32px 12px 16px}.account,.sidebar-bottom{margin-top:auto}.sidebar-bottom small,.account small{font-size:12px;line-height:16px;color:var(--ink-muted)}.sidebar-bottom strong,.account strong{font-size:14px;line-height:20px}.sidebar-bottom,.account{border-color:var(--line);padding-top:24px}.sidebar-bottom{align-items:flex-start}.sidebar-bottom div{min-width:0}.sidebar-bottom small{white-space:normal}.nav svg{width:20px;height:20px}.sidebar-bottom .avatar,.account .avatar{flex-shrink:0}.topbar .restaurant span,header>div>span{color:var(--ink-muted)}
html[data-app=mesa-entregador] header,html[data-app=mesa-entregador] .app,html[data-app=mesa-entregador] .bottom-inner{max-width:560px;margin:auto}html[data-app=mesa-entregador] header{padding:24px;display:grid;grid-template-columns:1fr auto;gap:16px}html[data-app=mesa-entregador] .appearance{grid-column:1/-1;justify-self:end}html[data-app=mesa-entregador] .app{padding:32px 24px 112px}html[data-app=mesa-entregador] .heading{margin-bottom:24px}html[data-app=mesa-entregador] .heading .demo{display:none}html[data-app=mesa-entregador] .offers,html[data-app=mesa-entregador] .active-layout{grid-template-columns:1fr;gap:16px}html[data-app=mesa-entregador] .offers .actions .primary,html[data-app=mesa-entregador] .next .primary{min-height:48px}html[data-app=mesa-entregador] .button{min-height:48px}html[data-app=mesa-entregador] .availability{background:var(--surface);border:1px solid var(--line);padding:16px;border-radius:var(--radius-lg)}html[data-app=mesa-entregador] .availability strong{font-size:14px;line-height:20px}html[data-app=mesa-entregador] .availability:not(.offline) .statusdot{background:var(--accent)}html[data-app=mesa-entregador] .availability .sub{font-size:13px;line-height:18px}html[data-app=mesa-entregador] .switch{background:var(--action);padding:4px;border-radius:var(--radius-full)}html[data-app=mesa-entregador] .switch i{background:var(--on-action);border-radius:var(--radius-full)}html[data-app=mesa-entregador] .switch[aria-checked=false]{background:var(--ink-subtle)}html[data-app=mesa-entregador] .bottom{background:var(--surface);border-color:var(--line);backdrop-filter:none;padding:16px}html[data-app=mesa-entregador] .bottom .demo{background:var(--surface-sunken);color:var(--ink-muted)}html[data-app=mesa-entregador] .payrow{padding:8px 16px 16px}html[data-app=mesa-entregador] .offer-top{padding:16px 16px 0}html[data-app=mesa-entregador] .stats{padding:12px 16px;gap:16px;border-color:var(--line);font-size:13px;line-height:18px;flex-wrap:wrap}html[data-app=mesa-entregador] .route{padding:16px 16px 0}html[data-app=mesa-entregador] .actions{padding:16px}html[data-app=mesa-entregador] .pickup-note{margin:16px 16px 0;padding:8px 12px}html[data-app=mesa-entregador] .amount small{font-size:20px;line-height:28px}html[data-app=mesa-entregador] .tag{font-size:12px;line-height:16px}html[data-app=mesa-entregador] .active-card .route{padding-bottom:16px}html[data-app=mesa-entregador] .identity .name{font-size:14px;line-height:20px}html[data-app=mesa-entregador] .identity span{font-size:12px;line-height:16px}.identity .avatar{flex-shrink:0}
@media(max-width:1279px){.dashboard-grid{grid-template-columns:1fr}.workspace{padding:32px 24px}.metrics{gap:16px}}
@media(max-width:1023px){html[data-app=mesa] aside,html[data-app=mesa-crm] aside{display:none;position:fixed;inset:0 auto 0 0;height:100dvh;width:248px;padding:24px 16px}html[data-app=mesa].menu-open aside,html[data-app=mesa-crm].menu-open aside{display:flex}html[data-app=mesa] main,html[data-app=mesa-crm] main{margin-left:0;margin-bottom:0}.menu-toggle{display:grid;flex-shrink:0}.brand>div,.sidebar-bottom div,.account>div:last-child{display:block}.navlabel,.nav-label{display:block}.nav-button{flex-direction:row;justify-content:flex-start;height:40px;font-size:14px}.nav-button span,.nav span{display:inline;font-size:14px}.nav-button .badge,.nav b{display:inline}.nav{margin-top:0;justify-content:flex-start}.nav-button svg{width:20px;height:20px}nav{display:grid;margin-top:0;gap:4px}.sidebar-bottom,.account{justify-content:flex-start}.board{grid-template-columns:1fr}.cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.column{background:transparent;padding:0;border-radius:0}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar{flex-wrap:wrap}.nav-label{margin:32px 12px 16px}.workspace{padding:24px}.topbar,header{padding:16px 24px}.nav-button .badge{margin-left:auto}.sidebar-bottom{display:flex}.heading{flex-wrap:wrap}html.menu-open{overflow:hidden}}
@media(max-width:639px){.workspace{padding:24px 16px}.cards{grid-template-columns:1fr}.metrics{gap:16px}.topbar,header{padding:16px;gap:12px}.appearance{margin-left:auto}.theme-label{display:none}.topbar .demo,header>.demo{display:none}.topbar .topright{margin-left:auto}.tabs{gap:4px;width:auto}.tab{font-size:13px;padding:4px 12px}.toolbar .search{width:100%}.heading{gap:16px}.panel-heading,.panel-body{padding:16px}.pipeline{grid-template-columns:repeat(2,1fr);gap:8px}.crm-stages{gap:8px}.crm-stage{padding:16px 12px}.metric{padding:16px}.metric label{font-size:12px;line-height:16px}.metric .value{font-size:28px;line-height:34px}.metric small{font-size:12px;line-height:16px}.search input{width:100%}.date{display:none}html[data-app=mesa-entregador] .app{padding:24px 16px 112px}html[data-app=mesa-entregador] header{padding:16px}html[data-app=mesa-entregador] .identity .name{display:none}.history-row{gap:16px;flex-wrap:wrap}.bottom .location{font-size:12px;line-height:16px}.next{padding:16px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}

.availability.busy .statusdot{background:var(--ink)!important}.pickup-note:before{content:'';display:block;width:6px;height:6px;border:1.5px solid currentColor;border-radius:var(--radius-full);flex-shrink:0}.pickup-note svg{display:none}.table-wrap td:nth-last-child(2):has(+td button){font-variant-numeric:tabular-nums}

.drawer-close{display:none}@media(max-width:1023px){.drawer-close{display:grid;align-self:flex-end;margin-bottom:8px}}
```

### Arquivo `shared/theme.js`

```javascript
(()=>{const media=window.matchMedia('(prefers-color-scheme: dark)');let preference='light';try{preference=localStorage.getItem('solution-delivery-calm-theme')||'light'}catch{}if(!['system','light','dark'].includes(preference))preference='light';function apply(){const theme=preference==='system'?(media.matches?'dark':'light'):preference;document.documentElement.dataset.theme=theme;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='dark'?'#161c16':'#f8f9f5'}apply();media.addEventListener?.('change',()=>{if(preference==='system')apply()});document.addEventListener('DOMContentLoaded',()=>{const select=document.getElementById('theme-choice');if(select){select.value=preference;select.addEventListener('change',()=>{preference=select.value;try{localStorage.setItem('solution-delivery-calm-theme',preference)}catch{}apply()})}const button=document.getElementById('menu-toggle'),overlay=document.getElementById('drawer-overlay'),sidebar=document.getElementById('sidebar');if(button&&overlay&&sidebar){function setOpen(open){document.documentElement.classList.toggle('menu-open',open);overlay.hidden=!open;button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');if(open)sidebar.querySelector('button')?.focus();else button.focus()}button.addEventListener('click',()=>setOpen(!document.documentElement.classList.contains('menu-open')));overlay.addEventListener('click',()=>setOpen(false));document.getElementById('drawer-close')?.addEventListener('click',()=>setOpen(false));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.documentElement.classList.contains('menu-open'))setOpen(false)});sidebar.addEventListener('click',e=>{if(e.target.closest('.nav-button'))setOpen(false)});document.addEventListener('focusin',e=>{if(document.documentElement.classList.contains('menu-open')&&!sidebar.contains(e.target)&&e.target!==button&&e.target!==overlay)sidebar.querySelector('button')?.focus()})}})})();
```

### Arquivo `estabelecimento/index.html`

```html
<!doctype html><html lang="pt-BR" data-app="mesa"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Solution Delivery — Gestão de entregas</title><meta name="description" content="Gerencie a coleta e a entrega de pedidos."><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23303a31'/%3E%3Ccircle cx='16' cy='16' r='8.5' fill='none' stroke='%23f8f9f5' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='3.5' fill='%235f7656'/%3E%3C/svg%3E"><link rel="stylesheet" href="layout.css"><link rel="stylesheet" href="../shared/tokens.css"><link rel="stylesheet" href="../shared/identity.css"><script src="../shared/theme.js"></script></head><body><aside id="sidebar"><button id="drawer-close" class="drawer-close icon-button" aria-label="Fechar menu">×</button><div class="brand"><svg class="solution-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="var(--ink)" stroke="none"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--bg)" stroke-width="2"/><circle cx="16" cy="16" r="3.5" fill="var(--accent)" stroke="none"/></svg><div class="brand-name"><strong>Solution</strong><span> Delivery</span><small>ESTABELECIMENTO</small></div></div><div class="navlabel">OPERAÇÃO</div><div class="nav"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 3h6v4H9zM9 12h6M9 16h4"/></svg><span>Entregas</span><b id="nav-count">6</b></div><div class="sidebar-note">Da coleta ao destino.<br>Cada entrega em seu lugar.</div><div class="account"><div class="avatar">AC</div><div><strong>Ana Costa</strong><small>Gestora de operação</small></div></div></aside><button class="drawer-overlay" id="drawer-overlay" hidden aria-label="Fechar menu"></button><main><header class="topbar"><button class="menu-toggle" id="menu-toggle" aria-label="Abrir menu" aria-controls="sidebar" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><div class="restaurant"><strong>Central de entregas</strong><span>Vila Madalena · São Paulo</span></div><div class="topright"><span class="demo">Ambiente de demonstração</span><button class="store" id="store" aria-pressed="true"><i class="dot"></i><span>Operação ativa</span></button></div><div class="appearance"><label class="theme-label" for="theme-choice">Tema</label><select id="theme-choice" aria-label="Tema da interface"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></div></header><div class="workspace"><div class="heading"><div><div class="eyebrow">LOGÍSTICA COM CLAREZA</div><h1>Gestão de entregas</h1><p class="subtitle">Distribua as coletas e acompanhe as entregas em andamento.</p></div><div class="date">Hoje · 06 de outubro</div></div><section class="metrics" aria-label="Resumo da operação"><div class="metric"><label>Entregas em andamento</label><div class="value" id="active-count">6</div><small id="new-count">2 aguardando entregador</small></div><div class="metric"><label>Entregues nesta sessão</label><div class="value" id="done-count">0</div><small>Entregas finalizadas</small></div><div class="metric"><label>Fretes em andamento</label><div class="value" id="revenue">R$ 0,00</div><small>Valor das entregas ativas</small></div><div class="metric"><label>Prazo de entrega</label><div class="value">25 <span style="font-size:var(--font-heading);color:var(--muted);font-weight:400">min</span></div><small>Estimativa para esta região</small></div></section><div class="toolbar"><div class="tabs" role="tablist" aria-label="Visualização de pedidos"><button class="tab active" role="tab" aria-selected="true" data-view="active">Em andamento <span id="tab-active">6</span></button><button class="tab" role="tab" aria-selected="false" data-view="done">Concluídos <span id="tab-done">0</span></button></div><label class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input id="search" placeholder="Buscar entrega ou cliente" aria-label="Buscar entrega ou cliente"></label></div><section class="board" id="board" aria-label="Quadro de entregas"></section><footer class="foot"><span>Dados ilustrativos · Alterações válidas apenas nesta sessão.</span><span>Solution Delivery</span></footer></div></main><dialog id="detail"><div id="detail-content"></div><button class="primary" id="close-dialog">Fechar detalhes</button></dialog><div class="toast" id="toast" role="status"></div><script>
const orders=[{id:1048,name:'Marina Oliveira',time:'há 2 min',type:'Entrega',address:'Rua das Flores, 120 · Vila Madalena',items:[[2,'Bowl de frango grelhado'],[1,'Suco de laranja']],note:'Sem cebola, por favor.',price:9.9,pay:'Pago · Pix',stage:0},{id:1047,name:'Pedro Santos',time:'há 5 min',type:'Entrega',address:'Rua Aspicuelta, 210 · Vila Madalena',items:[[1,'Hambúrguer da casa'],[1,'Batata rústica']],price:7.9,pay:'Pago · Cartão',stage:0},{id:1046,name:'Camila Rocha',time:'há 12 min',type:'Entrega',address:'Rua Harmonia, 86 · Vila Madalena',items:[[1,'Risoto de cogumelos'],[1,'Água com gás']],price:8.5,pay:'Pago · Pix',stage:1},{id:1045,name:'Lucas Almeida',time:'há 16 min',type:'Entrega',address:'Rua Wisard, 240 · Vila Madalena',items:[[2,'Prato da vila'],[2,'Suco de limão']],note:'Enviar talheres.',price:12,pay:'Pago · Cartão',stage:1},{id:1044,name:'Julia Ferreira',time:'há 22 min',type:'Entrega',address:'Rua Girassol, 315 · Vila Madalena',items:[[1,'Bowl vegetariano'],[1,'Chá gelado']],price:8.9,pay:'Pago · Pix',stage:2},{id:1043,name:'Rafael Lima',time:'há 25 min',type:'Entrega',address:'Rua Fidalga, 90 · Vila Madalena',items:[[2,'Hambúrguer da casa']],price:10.5,pay:'Pago · Pix',stage:2}];const couriers=['Bruno Martins','Carla Souza','Diego Alves'];orders.forEach((o,i)=>{o.origin=['Cozinha da Vila','Burger do Bairro','Cantina Harmonia'][i%3];o.courier=o.stage?couriers[(i-2+3)%3]:null;o.distance=[2.4,1.8,3.2,4.1,2.7,3.5][i]});let view='active';const currency=x=>x.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),$=id=>document.getElementById(id);function render(){let active=orders.filter(o=>o.stage<3),done=orders.filter(o=>o.stage===3);$('active-count').textContent=active.length;$('nav-count').textContent=active.length;$('new-count').textContent=active.filter(o=>o.stage===0).length+' aguardando entregador';$('done-count').textContent=done.length;$('revenue').textContent=currency(active.reduce((s,o)=>s+o.price,0));$('tab-active').textContent=active.length;$('tab-done').textContent=done.length;const q=$('search').value.trim().toLowerCase();const stages=view==='active'?[0,1,2]:[3];$('board').style.gridTemplateColumns=view==='done'?'1fr':'';$('board').innerHTML=stages.map(stage=>{const list=orders.filter(o=>o.stage===stage&&(o.name.toLowerCase().includes(q)||String(o.id).includes(q)));return `<div class="column"><div class="column-head"><div class="col-title"><i></i>${['Aguardando entregador','Em coleta','Em rota','Entregues'][stage]}</div><span>${list.length}</span></div><div class="cards">${list.map(o=>`<article class="card"><div class="card-top"><span class="order-id">#${o.id}</span><span class="status status-${stage}">${["Aguardando entregador","Em coleta","Em rota","Entregue"][stage]}</span></div><div class="customer">${o.name}</div><div class="delivery">${o.origin} · ${o.distance} km</div><div class="items"><div style="font-size:var(--font-caption);color:var(--muted)">DESTINO</div><div>${o.address}</div></div><div class="note">${o.courier?'Entregador: '+o.courier:'Aguardando atribuição de entregador'}</div><div class="card-bottom"><span class="price">${currency(o.price)}</span><span class="payment">Frete</span></div><div class="actions">${stage<3?`<button class="primary" data-advance="${o.id}">${['Atribuir entregador','Confirmar coleta','Confirmar entrega'][stage]}</button>`:''}<button class="secondary" data-detail="${o.id}">Detalhes</button></div></article>`).join('')||'<div class="empty">Nenhum pedido nesta etapa.</div>'}</div></div>`}).join('')}function advance(id){const o=orders.find(x=>x.id===Number(id));if(!o||o.stage>=3)throw Error('Pedido inválido ou já concluído.');o.stage++;render();notify('Entrega #'+o.id+' atualizado.');return{id:o.id,status:['novo','em_preparo','pronto','concluido'][o.stage]}}function notify(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').style.display='none',3000)}$('board').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.advance){const o=orders.find(x=>x.id===Number(b.dataset.advance));if(o.stage===0){$('detail-content').innerHTML=`<div class="eyebrow">ATRIBUIR ENTREGA</div><h2>Entrega #${o.id}</h2><p>Selecione um entregador para coletar em ${o.origin}.</p><label style="display:block;font-size:var(--font-body)" for="courier">Entregador</label><select id="courier" style="width:100%;padding:12px;margin:8px 0;border:1px solid var(--line);border-radius:var(--radius-sm);font:inherit">${couriers.map(c=>`<option>${c}</option>`).join('')}</select><button class="primary" id="assign">Confirmar atribuição</button>`;$('detail').showModal();$('assign').onclick=()=>{o.courier=$('courier').value;advance(o.id);$('detail').close()}}else advance(o.id)}if(b.dataset.detail){const o=orders.find(x=>x.id===Number(b.dataset.detail));$('detail-content').innerHTML=`<div class="eyebrow">${['AGUARDANDO ENTREGADOR','EM COLETA','EM ROTA','ENTREGUE'][o.stage]}</div><h2>Entrega #${o.id}</h2><p>Coleta: <strong>${o.origin}</strong><br>Entregador: ${o.courier||'Não atribuído'}<br>Distância: ${o.distance} km</p><p><strong>${o.name}</strong><br>${o.address}</p><div class="items">${o.items.map(i=>`<div>${i[0]}× ${i[1]}</div>`).join('')}</div>${o.note?`<p>${o.note}</p>`:''}<p><strong>${currency(o.price)}</strong> · Frete</p>`;$('detail').showModal()}});$('close-dialog').onclick=()=>$('detail').close();$('detail').addEventListener('click',e=>{if(e.target===$('detail'))$('detail').close()});$('search').addEventListener('input',render);document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('.tab').forEach(t=>{t.classList.toggle('active',t===b);t.setAttribute('aria-selected',String(t===b))});render()});$('store').onclick=()=>{const open=$('store').getAttribute('aria-pressed')!=='true';$('store').setAttribute('aria-pressed',String(open));$('store').classList.toggle('closed',!open);$('store').querySelector('span').textContent=open?'Operação ativa':'Operação pausada';notify(open?'Operação retomada nesta demonstração.':'Operação pausada nesta demonstração.')};render();if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'advance_demo_delivery',description:'Avança uma entrega de demonstração à próxima etapa. Para atribuir, exige courier. Não altera entregas reais.',inputSchema:{type:'object',properties:{deliveryId:{type:'integer'},courier:{type:'string',enum:couriers}},required:['deliveryId'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||!Number.isInteger(input.deliveryId))throw Error('deliveryId deve ser inteiro.');const o=orders.find(x=>x.id===input.deliveryId);if(!o)throw Error('Entrega inexistente.');if(o.stage===0){if(!couriers.includes(input.courier))throw Error('Selecione um entregador válido.');o.courier=input.courier}return advance(o.id)}})).catch(()=>{})}catch{}}
</script></body></html>
```

### Arquivo `estabelecimento/layout.css`

```css

*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg);font-size:var(--font-heading)}button,input{font:inherit}button{cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid var(--ink-muted);outline-offset:3px}button{color:inherit}aside{width:228px;position:fixed;inset:0 auto 0 0;background:var(--surface);border-right:1px solid var(--line);padding:32px 24px;display:flex;flex-direction:column}.brand{font-size:var(--font-kpi);letter-spacing:-1.5px;font-weight:750;display:flex;align-items:center;gap:8px}.mark{background:var(--green);color:var(--surface);width:33px;height:33px;border-radius:var(--radius-lg);font-size:var(--font-title);text-align:center;line-height:33px;letter-spacing:-3px;padding-right:4px}.brand small{font-size:var(--font-caption);letter-spacing:2px;font-weight:500;display:block;color:var(--muted)}.navlabel{font-size:var(--font-caption);letter-spacing:1.6px;color:var(--ink-muted);margin:40px 12px 16px}.nav{display:flex;align-items:center;gap:12px;border:0;text-align:left;padding:12px;border-radius:var(--radius-sm);background:var(--soft);color:var(--green);font-weight:650}.nav svg{width:20px;height:20px}.nav b{margin-left:auto;font-size:var(--font-caption);background:var(--line);padding:4px 4px;border-radius:var(--radius-sm)}.sidebar-note{font-size:var(--font-body);color:var(--muted);line-height:1.7;padding:16px 12px}.account{margin-top:auto;border-top:1px solid var(--line);padding-top:24px;display:flex;gap:12px;align-items:center}.avatar{width:38px;height:38px;border-radius:var(--radius-lg);background:var(--line);color:var(--ink-muted);display:grid;place-items:center;font-weight:650}.account strong{font-size:var(--font-body)}.account small{display:block;color:var(--muted);margin-top:4px;font-size:var(--font-caption)}main{margin-left:40px}.topbar{padding:24px 40px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);background:var(--surface)}.restaurant strong{font-size:var(--font-heading)}.restaurant span{display:block;color:var(--muted);font-size:var(--font-caption);margin-top:4px}.store{border:1px solid var(--line);border-radius:var(--radius-full);padding:8px 12px;background:var(--surface);font-size:var(--font-body);display:flex;align-items:center;gap:8px}.dot{width:7px;height:7px;border-radius:var(--radius-full);background:var(--ink-muted)}.store.closed .dot{background:var(--ink-muted)}.workspace{padding:32px 40px;max-width:1600px;margin:auto}.heading{display:flex;justify-content:space-between;align-items:center;gap:16px}.eyebrow{font-size:var(--font-caption);letter-spacing:1.5px;color:var(--muted);margin-bottom:8px}h1{font-size:var(--font-display);font-weight:600;letter-spacing:-1.1px;margin:0 0 8px}.subtitle{color:var(--muted);margin:0;font-size:var(--font-body)}.date{font-size:var(--font-body);color:var(--muted);border:1px solid var(--line);padding:8px 12px;border-radius:var(--radius-sm);background:var(--surface-sunken)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:32px 0}.metric{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px}.metric label{font-size:var(--font-body);color:var(--muted)}.metric .value{font-size:var(--font-kpi);letter-spacing:-1px;margin-top:12px;font-weight:600}.metric small{display:block;font-size:var(--font-caption);color:var(--muted);margin-top:8px}.metric:first-child{background:var(--line);border-color:var(--line)}.metric:first-child small{color:var(--ink-muted)}.toolbar{display:flex;justify-content:space-between;gap:16px;align-items:center;margin:32px 0 24px}.tabs{display:flex;gap:24px;align-items:center}.tab{padding:8px 0;border:0;background:transparent;color:var(--muted);font-size:var(--font-body);border-bottom:2px solid transparent}.tab.active{border-color:var(--green);color:var(--ink);font-weight:600}.tab span{background:var(--line);border-radius:var(--radius-sm);padding:4px 4px;margin-left:4px;font-size:var(--font-caption)}.search{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);padding:8px 12px}.search input{border:0;outline:0;background:none;width:195px;font-size:var(--font-body)}.search svg{width:17px;color:var(--muted)}.board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.column{min-width:0}.column-head{display:flex;align-items:center;justify-content:space-between;padding:0 0px 16px;font-size:var(--font-body);font-weight:600}.column-head span{font-size:var(--font-caption);background:var(--line);border-radius:var(--radius-sm);padding:4px 8px;color:var(--ink-muted)}.col-title{display:flex;align-items:center;gap:8px}.col-title i{width:8px;height:8px;background:var(--ink-muted);border-radius:var(--radius-sm)}.column:nth-child(2) i{background:var(--ink-muted)}.column:nth-child(3) i{background:var(--ink-muted)}.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px;transition:transform .15s,box-shadow .15s}.card:hover{}.card-top{display:flex;justify-content:space-between;align-items:center}.order-id{font-size:var(--font-heading);font-weight:650}.time{font-size:var(--font-caption);color:var(--ink-muted);background:var(--surface-sunken);padding:4px 8px;border-radius:var(--radius-sm)}.customer{font-size:var(--font-body);margin:16px 0 4px}.delivery{font-size:var(--font-caption);color:var(--muted)}.items{border-top:1px solid var(--surface-sunken);margin-top:16px;padding-top:12px;font-size:var(--font-body);line-height:1.9;color:var(--ink-muted)}.items b{font-weight:500;color:var(--ink-muted);margin-right:8px}.note{background:var(--surface-sunken);border-radius:var(--radius-sm);font-size:var(--font-caption);padding:8px 8px;color:var(--ink-muted);margin:8px 0}.card-bottom{display:flex;justify-content:space-between;align-items:center;margin:16px 0}.price{font-size:var(--font-heading);font-weight:600}.payment{font-size:var(--font-caption);color:var(--ink-muted);background:var(--surface-sunken);border-radius:var(--radius-sm);padding:4px 8px}.actions{display:flex;gap:8px}.primary{background:var(--green);color:var(--surface);border:1px solid var(--green);border-radius:var(--radius-sm);padding:8px 12px;font-size:var(--font-body);flex:1}.secondary{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);padding:8px 12px;font-size:var(--font-body)}.empty{padding:32px 16px;text-align:center;border:1px dashed var(--line);border-radius:var(--radius-lg);color:var(--muted);font-size:var(--font-body)}.foot{display:flex;justify-content:space-between;margin-top:24px;font-size:var(--font-caption);color:var(--ink-muted);gap:16px}.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 16px;background:var(--ink);color:var(--surface);border-radius:var(--radius-sm);display:none;z-index:5;font-size:var(--font-body)}dialog{border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;width:440px;max-width:calc(100% - 32px);color:var(--ink)}dialog::backdrop{background:var(--overlay)}dialog h2{margin-top:0;font-size:var(--font-title)}dialog p{font-size:var(--font-body);line-height:1.7}dialog .primary{width:100%;margin-top:16px}.demo{font-size:var(--font-caption);background:var(--surface-sunken);border:1px solid var(--line);padding:8px 12px;border-radius:var(--radius-sm);color:var(--ink-muted)}.topright{display:flex;gap:16px;align-items:center}@media(min-width:1500px){.workspace{padding-top:40px}}@media(max-width:1150px){aside{width:190px;padding:32px 16px}main{margin-left:40px}.workspace{padding:24px 24px}.topbar{padding:16px 24px}.board{gap:12px}.card{padding:16px}.tabs{gap:12px}.metrics{gap:8px}.metric{padding:16px}}@media(max-width:950px){aside{width:78px;padding:24px 12px}.brand>div:last-child,.navlabel,.nav span,.nav b,.sidebar-note,.account>div:last-child{display:none}.nav{margin-top:40px;padding:12px}.brand{justify-content:center}.account{justify-content:center}main{margin-left:40px}.board{grid-template-columns:1fr}.column{background:var(--surface-sunken);border-radius:var(--radius-lg);padding:12px}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{margin:0}.metrics{grid-template-columns:repeat(2,1fr)}.toolbar{flex-wrap:wrap}.search{flex:1}.search input{width:100%}}@media(max-width:600px){aside{display:none}main{margin:0}.workspace{padding:24px 16px}.topbar{padding:16px 16px}.demo{display:none}.heading{align-items:start}.date{display:none}h1{font-size:var(--font-kpi)}.metrics{margin:24px 0;gap:8px}.metric{padding:16px}.metric .value{font-size:var(--font-kpi)}.cards{grid-template-columns:1fr}.toolbar{margin-top:24px}.tabs{width:100%;justify-content:space-between;gap:8px}.foot{flex-direction:column;gap:8px}.search{width:100%}.topright{gap:8px}.store{font-size:var(--font-caption)}.restaurant strong{font-size:var(--font-body)}}
```

### Arquivo `entregador/index.html`

```html
<!doctype html>
<html lang="pt-BR" data-app="mesa-entregador"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f8f9f5"><title>Solution Delivery — App do entregador</title><meta name="description" content="Receba ofertas, aceite pedidos e acompanhe cada etapa da entrega."><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23303a31'/%3E%3Ccircle cx='16' cy='16' r='8.5' fill='none' stroke='%23f8f9f5' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='3.5' fill='%235f7656'/%3E%3C/svg%3E"><link rel="stylesheet" href="layout.css"><link rel="stylesheet" href="../shared/tokens.css"><link rel="stylesheet" href="../shared/identity.css"><script src="../shared/theme.js"></script></head><body>
<header><div class="brand"><svg class="solution-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="var(--ink)" stroke="none"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--bg)" stroke-width="2"/><circle cx="16" cy="16" r="3.5" fill="var(--accent)" stroke="none"/></svg><div class="brand-name"><strong>Solution</strong><span> Delivery</span><small>ENTREGADOR</small></div></div><div class="identity"><div class="name">Bruno Martins<span>Entregador</span></div><div class="avatar">BM</div></div><div class="appearance"><label class="theme-label" for="theme-choice">Tema</label><select id="theme-choice" aria-label="Tema da interface"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></div></header>
<main class="app"><div class="heading"><div><h1>Olá, Bruno.</h1><p class="sub">Sua próxima entrega começa aqui.</p></div><span class="demo">Ambiente de demonstração</span></div><section class="availability" id="availability" aria-label="Disponibilidade"><div><strong><i class="statusdot"></i><span id="status-title">Você está disponível</span></strong><p class="sub" id="status-description">Recebendo ofertas na Vila Madalena.</p></div><button class="switch" id="online" role="switch" aria-checked="true" aria-label="Disponível para receber entregas"><i></i></button></section>
<nav class="tabs" role="tablist" aria-label="Entregas"><button class="tab active" role="tab" aria-selected="true" aria-controls="content" data-view="offers">Ofertas <span class="badge" id="offer-count">3</span></button><button class="tab" role="tab" aria-selected="false" aria-controls="content" data-view="active">Minha entrega <span class="badge" id="active-count" hidden>1</span></button><button class="tab" role="tab" aria-selected="false" aria-controls="content" data-view="done">Concluídas</button></nav><section id="content" role="tabpanel"></section><p class="fine">Demonstração com ofertas ilustrativas. Aceites e alterações valem apenas nesta sessão e não são enviados à central de entregas.</p></main>
<footer class="bottom"><div class="bottom-inner"><span class="location"><svg viewBox="0 0 24 24"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>Vila Madalena · São Paulo</span><span class="demo">Protótipo</span></div></footer><dialog id="confirm" aria-labelledby="dialog-title"><h2 id="dialog-title">Aceitar esta entrega?</h2><div id="dialog-content"></div><div class="actions"><button class="button secondary" id="cancel">Voltar</button><button class="button primary" id="confirm-accept">Aceitar entrega</button></div></dialog><div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>
const offers=[{id:1048,origin:'Cozinha da Vila',pickup:'Rua Aspicuelta, 210 · Vila Madalena',client:'Marina Oliveira',destination:'Rua das Flores, 120 · Vila Madalena',distance:2.4,pickupDistance:0.6,minutes:18,fee:9.9,note:'Pedido pronto para coleta',customerNote:'Entregar na portaria.'},{id:1047,origin:'Burger do Bairro',pickup:'Rua Mourato Coelho, 480 · Vila Madalena',client:'Pedro Santos',destination:'Rua Fidalga, 90 · Vila Madalena',distance:1.8,pickupDistance:0.9,minutes:15,fee:7.9,note:'Pedido pronto para coleta',customerNote:'Casa com portão branco.'},{id:1046,origin:'Cantina Harmonia',pickup:'Rua Harmonia, 86 · Vila Madalena',client:'Camila Rocha',destination:'Rua Wisard, 240 · Vila Madalena',distance:3.2,pickupDistance:1.1,minutes:24,fee:12.5,note:'Coleta em aproximadamente 5 min',customerNote:'Apartamento 32. Chamar pelo interfone.'}];
const state={online:true,view:'offers',active:null,done:[],declined:[]};let pendingId=null;const $=id=>document.getElementById(id),money=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),num=n=>n.toLocaleString('pt-BR');const icon=(name)=>({clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',route:'<svg viewBox="0 0 24 24"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h9a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8"/></svg>',check:'<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',box:'<svg viewBox="0 0 24 24"><path d="m3 7 9-4 9 4v10l-9 4-9-4ZM3 7l9 4 9-4M12 11v10M7.5 5l9 4"/></svg>'})[name];
function route(o){return `<div class="route"><div class="stop"><i class="pin"></i><div><label>COLETA · ${num(o.pickupDistance)} km de você</label><strong>${o.origin}</strong><p class="address">${o.pickup}</p></div></div><div class="stop"><i class="pin"></i><div><label>ENTREGA</label><strong>${o.client}</strong><p class="address">${o.destination}</p></div></div></div>`}
function available(){return offers.filter(o=>!state.declined.includes(o.id)&&!state.done.some(d=>d.id===o.id)&&state.active?.id!==o.id)}
function empty(title,text,action=''){return `<div class="empty"><div class="empty-icon">${icon('box')}</div><h2>${title}</h2><p>${text}</p>${action}</div>`}
function render(){const list=available();$('online').setAttribute('aria-checked',String(state.online));$('online').disabled=!!state.active;$('availability').classList.toggle('offline',!state.online);$('availability').classList.toggle('busy',!!state.active);$('status-title').textContent=state.active?'Você está em uma entrega':state.online?'Você está disponível':'Você está indisponível';$('status-description').textContent=state.active?'Finalize a entrega para receber novas ofertas.':state.online?'Recebendo ofertas na Vila Madalena.':'Fique disponível quando quiser receber ofertas.';$('offer-count').textContent=state.online&&!state.active?list.length:0;$('active-count').hidden=!state.active;document.querySelectorAll('.tab').forEach(t=>{const selected=t.dataset.view===state.view;t.classList.toggle('active',selected);t.setAttribute('aria-selected',String(selected))});
if(state.view==='offers'){$('content').innerHTML=state.active?empty('Uma entrega por vez','Você já tem uma entrega em andamento.','<button class="button primary" data-view="active">Ver minha entrega</button>'):!state.online?empty('Você está indisponível','Ative sua disponibilidade para ver as ofertas.','<button class="button primary" data-online="true">Ficar disponível</button>'):list.length?`<div class="view-head"><h2>Entregas disponíveis</h2><span class="sub">${list.length} ofertas na região</span></div><div class="offers">${list.map(o=>`<article class="offer"><div class="offer-top"><span class="label">Você recebe</span><span class="offer-code">#${o.id}</span></div><div class="payrow"><div class="amount"><small>R$</small>${o.fee.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div><span class="tag">1 coleta · 1 entrega</span></div><div class="stats"><span>${icon('route')}${num(o.distance)} km de percurso</span><span>${icon('clock')}~${o.minutes} min</span></div>${route(o)}<div class="pickup-note">${icon('check')}${o.note}</div><div class="actions"><button class="button secondary" data-decline="${o.id}" aria-label="Recusar entrega ${o.id}">Recusar</button><button class="button primary" data-accept="${o.id}">Aceitar entrega</button></div></article>`).join('')}</div>`:empty('Nenhuma oferta disponível','Todas as ofertas desta demonstração foram concluídas ou recusadas.');}
else if(state.view==='active'){const o=state.active;if(!o){$('content').innerHTML=empty('Nenhuma entrega em andamento','Escolha uma oferta para começar.','<button class="button primary" data-view="offers">Ver ofertas</button>');return}const index=['accepted','arrived','collected'].indexOf(o.status);const titles=['Siga para a coleta','Confirme a retirada','Siga para a entrega'];const descriptions=['Vá até o restaurante e avise quando chegar.','Confira o número do pedido e retire o pacote no balcão.','Leve o pedido ao destino e confirme após entregar ao cliente.'];$('content').innerHTML=`<div class="view-head"><h2>Entrega #${o.id}</h2><span class="sub">${money(o.fee)} de frete</span></div><div class="active-layout"><article class="active-card"><div class="active-top"><span class="status ${index===2?'s-route':'s-collecting'}">${['ENTREGA ACEITA','NO RESTAURANTE','PEDIDO COLETADO'][index]}</span><h2>${index<2?o.origin:o.client}</h2><p class="sub">${index<2?o.pickup:o.destination}</p></div><div class="stepper">${['Coleta','Retirada','Entrega'].map((l,i)=>`<div class="step ${i<=index?'reached':''}">${l}</div>`).join('')}</div>${route(o)}</article><section class="next"><div class="label">PRÓXIMA ETAPA</div><h2>${titles[index]}</h2><p>${descriptions[index]}</p><div class="active-note">${index<2?'Pedido #'+o.id+' · '+o.note:o.customerNote}</div><a class="button secondary" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((index<2?o.pickup:o.destination)+', São Paulo, Brasil')}" target="_blank" rel="noopener">Abrir endereço no Maps</a><button class="button primary" data-advance="true">${['Cheguei ao restaurante','Confirmar retirada','Confirmar entrega'][index]}</button><div class="order-summary"><span>Você recebe</span><strong>${money(o.fee)}</strong></div></section></div>`;}
else{$('content').innerHTML=state.done.length?`<div class="finished-total"><div class="label">FRETES CONCLUÍDOS NESTA SESSÃO</div><div class="amount">${money(state.done.reduce((sum,o)=>sum+o.fee,0))}</div><p class="sub">${state.done.length} ${state.done.length===1?'entrega concluída':'entregas concluídas'}</p></div>${state.done.map(o=>`<article class="history-row"><div><strong>#${o.id} · ${o.origin}</strong><p>${o.client} · ${num(o.distance)} km</p></div><div class="earned">${money(o.fee)}</div></article>`).join('')}`:empty('Ainda não há entregas concluídas','As entregas finalizadas nesta sessão aparecerão aqui.');}}
function toast(text){$('toast').textContent=text;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').textContent='',3200)}
function setView(view){if(!['offers','active','done'].includes(view))throw Error('Visualização inválida.');state.view=view;render()}
function accept(id){if(!state.online)throw Error('Fique disponível para aceitar uma entrega.');if(state.active)throw Error('Você já tem uma entrega em andamento.');const o=available().find(o=>o.id===id);if(!o)throw Error('Oferta indisponível.');state.active={...o,status:'accepted'};state.view='active';render();toast('Entrega #'+id+' aceita. Siga para a coleta.');return{id,status:'accepted'}}
function advance(){const o=state.active;if(!o)throw Error('Nenhuma entrega em andamento.');if(o.status==='accepted'){o.status='arrived';toast('Chegada à coleta confirmada.')}else if(o.status==='arrived'){o.status='collected';toast('Retirada confirmada. Siga para a entrega.')}else if(o.status==='collected'){state.done.push({...o,status:'delivered'});state.active=null;state.view='done';toast('Entrega concluída. Obrigado, Bruno!')}else throw Error('Etapa inválida.');render();return{id:o.id,status:state.active?.status||'delivered'}}
function decline(id){if(!available().some(o=>o.id===id))throw Error('Oferta indisponível.');state.declined.push(id);render();toast('Oferta recusada nesta demonstração.');return{id,status:'declined'}}
function setOnline(online){if(state.active)throw Error('Finalize a entrega antes de alterar a disponibilidade.');state.online=online;render()}
$('online').onclick=()=>setOnline(!state.online);document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>setView(t.dataset.view));$('content').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.view)setView(b.dataset.view);if(b.dataset.online)setOnline(true);if(b.dataset.decline)decline(Number(b.dataset.decline));if(b.dataset.advance)advance();if(b.dataset.accept){const o=available().find(o=>o.id===Number(b.dataset.accept));if(!o)return;pendingId=o.id;$('dialog-content').innerHTML=`<p>Após aceitar, esta entrega ficará vinculada a você nesta demonstração.</p><div class="confirm-summary"><strong>${o.origin} · #${o.id}</strong>${num(o.distance)} km · ~${o.minutes} min<br>Você recebe <strong style="display:inline">${money(o.fee)}</strong></div>`;$('confirm').showModal()}});$('cancel').onclick=()=>$('confirm').close();$('confirm-accept').onclick=()=>{try{accept(pendingId);$('confirm').close()}catch(e){toast(e.message);$('confirm').close()}};render();
if(document.modelContext?.registerTool){const context=document.modelContext;try{Promise.resolve(context.registerTool({name:'accept_demo_delivery',description:'Aceita uma oferta de demonstração disponível e mostra a entrega ativa. Não envia pedidos à central.',inputSchema:{type:'object',properties:{deliveryId:{type:'integer'}},required:['deliveryId'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!Number.isInteger(input?.deliveryId))throw Error('deliveryId deve ser inteiro.');return accept(input.deliveryId)}})).catch(()=>{});Promise.resolve(context.registerTool({name:'advance_demo_delivery',description:'Confirma a próxima etapa da entrega de demonstração ativa: chegada, retirada ou conclusão.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>advance()})).catch(()=>{})}catch{}}
</script></body></html>
```

### Arquivo `entregador/layout.css`

```css

*{box-sizing:border-box}body{margin:0;color:var(--ink);background:var(--bg);font:16px/1.5 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,a,input{font:inherit}button{cursor:pointer;color:inherit}button:focus-visible,a:focus-visible{outline:3px solid var(--ink-muted);outline-offset:3px}button:disabled{opacity:.55;cursor:default}a{color:var(--green)}svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}header{max-width:1080px;margin:auto;display:flex;justify-content:space-between;align-items:center;padding:24px 24px;border-bottom:1px solid var(--line)}.brand{display:flex;gap:8px;align-items:center;letter-spacing:-1px;font-size:var(--font-kpi);font-weight:750}.mark{display:grid;place-items:center;width:34px;height:34px;background:var(--green);color:var(--surface);border-radius:var(--radius-lg);font-size:var(--font-title)}.brand small{letter-spacing:1.6px;display:block;font-size:var(--font-caption);font-weight:500;margin-top:-4px;color:var(--muted)}.identity{display:flex;align-items:center;gap:8px;font-size:var(--font-body)}.avatar{background:var(--line);width:37px;height:37px;border-radius:var(--radius-full);display:grid;place-items:center;font-weight:600;font-size:var(--font-sm)}.identity span{display:block;color:var(--muted);font-size:var(--font-caption)}.app{max-width:1080px;margin:auto;padding:32px 24px 40px}.heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px}h1{font-size:var(--font-kpi);letter-spacing:-1.1px;font-weight:600;line-height:1.25;margin:0 0 8px}h2{margin:0;font-size:var(--font-title);font-weight:600;letter-spacing:-.3px}p{margin:0}.sub{font-size:var(--font-body);color:var(--muted)}.demo{font-size:var(--font-caption);border:1px solid var(--line);background:var(--surface-sunken);border-radius:var(--radius-sm);padding:4px 8px;color:var(--ink-muted)}.availability{background:var(--soft);border:1px solid var(--line);border-radius:var(--radius-lg);padding:16px 16px;display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px}.availability strong{font-size:var(--font-heading);font-weight:600;display:flex;align-items:center;gap:8px}.statusdot{width:7px;height:7px;background:var(--ink-muted);border-radius:var(--radius-full)}.availability .sub{font-size:var(--font-sm);margin-top:4px}.switch{width:47px;height:29px;background:var(--green);border:0;border-radius:var(--radius-full);padding:4px;flex-shrink:0}.switch i{display:block;width:21px;height:21px;background:var(--surface);border-radius:var(--radius-full);transform:translateX(18px);transition:transform .2s}.switch[aria-checked=false]{background:var(--ink-muted)}.switch[aria-checked=false] i{transform:translateX(0)}.availability.offline{background:var(--line);border-color:var(--line)}.availability.offline .statusdot{background:var(--ink-muted)}.tabs{display:flex;border-bottom:1px solid var(--line);gap:24px;margin-bottom:24px}.tab{padding:0 0 12px;border:0;background:none;font-size:var(--font-body);color:var(--muted);border-bottom:2px solid transparent;display:flex;align-items:center;gap:8px}.tab.active{color:var(--green);border-bottom-color:var(--green);font-weight:600}.badge{font-size:var(--font-caption);line-height:1.6;background:var(--line);padding:0 4px;border-radius:var(--radius-sm)}.view-head{display:flex;justify-content:space-between;align-items:center;margin:0 0 16px;gap:12px}.view-head .sub{font-size:var(--font-caption)}.offers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.offer{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden}.offer-top{display:flex;justify-content:space-between;align-items:center;padding:24px 24px 0}.label{font-size:var(--font-caption);letter-spacing:1px;text-transform:uppercase;color:var(--muted)}.offer-code{font-size:var(--font-sm);color:var(--muted)}.payrow{padding:8px 24px 16px;display:flex;justify-content:space-between;gap:16px;align-items:center}.amount{font-size:var(--font-display);letter-spacing:-1.3px;line-height:1.3;font-weight:650}.amount small{font-size:var(--font-title);letter-spacing:-.3px;margin-right:4px;font-weight:500}.tag{border:1px solid var(--line);background:var(--surface-sunken);padding:4px 8px;border-radius:var(--radius-sm);font-size:var(--font-caption);color:var(--ink-muted)}.stats{display:flex;padding:12px 24px;gap:24px;border-top:1px solid var(--surface-sunken);border-bottom:1px solid var(--surface-sunken);color:var(--muted);font-size:var(--font-body)}.stats span{display:flex;align-items:center;gap:8px}.stats svg{width:17px;height:17px}.route{padding:24px 24px 0}.stop{position:relative;display:flex;gap:16px;padding-bottom:24px}.stop:last-child{padding-bottom:0}.stop:first-child:after{position:absolute;content:'';top:22px;bottom:0;left:8px;width:1px;background:var(--line)}.pin{width:17px;height:17px;border:2px solid var(--ink-muted);border-radius:var(--radius-full);margin-top:4px;flex-shrink:0;position:relative;background:var(--surface);z-index:1}.stop:last-child .pin{border-radius:var(--radius-sm);border-color:var(--green);background:var(--soft)}.stop label{font-size:var(--font-caption);color:var(--muted);display:block;margin-bottom:4px}.stop strong{display:block;font-size:var(--font-heading);font-weight:600;overflow-wrap:anywhere}.address{font-size:var(--font-body);color:var(--muted);margin-top:0px;overflow-wrap:anywhere}.pickup-note{display:flex;align-items:center;gap:8px;font-size:var(--font-caption);color:var(--ink-muted);margin:16px 24px 0;background:var(--surface-sunken);border-radius:var(--radius-sm);padding:8px 12px}.pickup-note svg{width:16px;height:16px}.actions{padding:16px 24px;display:flex;gap:8px}.button{border-radius:var(--radius-sm);min-height:47px;font-size:var(--font-body);font-weight:600;padding:12px 16px;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;border:1px solid var(--line);background:var(--surface)}.primary{background:var(--green);color:var(--surface);border-color:var(--green);flex:1}.secondary{color:var(--muted);background:var(--surface)}.fine{font-size:var(--font-caption);color:var(--muted);line-height:1.6;margin-top:24px}.bottom{position:fixed;bottom:0;left:0;right:0;background:var(--overlay);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:12px max(16px,env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom));z-index:3}.bottom-inner{max-width:1024px;margin:auto;display:flex;justify-content:space-between;align-items:center;gap:12px}.bottom .location{display:flex;align-items:center;gap:8px;font-size:var(--font-sm);color:var(--muted)}.bottom svg{width:18px}.bottom .demo{font-size:var(--font-caption);background:var(--surface-sunken)}.empty{border:1px dashed var(--line);background:var(--surface-sunken);border-radius:var(--radius-lg);padding:40px 24px;text-align:center;max-width:600px;margin:auto}.empty-icon{width:52px;height:52px;display:grid;place-items:center;margin:0 auto 16px;border-radius:var(--radius-lg);background:var(--soft);color:var(--green)}.empty p{font-size:var(--font-body);color:var(--muted);margin:8px 0 16px}.active-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:24px}.active-card{border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden;background:var(--surface)}.active-top{background:var(--soft);padding:24px 24px}.active-top .label{color:var(--green)}.active-top h2{font-size:var(--font-title);margin:8px 0}.stepper{display:flex;gap:8px;padding:16px 24px 4px}.step{flex:1;font-size:var(--font-caption);color:var(--muted)}.step:before{content:'';display:block;height:3px;background:var(--line);border-radius:var(--radius-sm);margin-bottom:8px}.step.reached{color:var(--green)}.step.reached:before{background:var(--ink-muted)}.active-card .route{padding-bottom:24px}.next{border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;background:var(--surface);height:fit-content}.next h2{margin:12px 0 8px}.next p{font-size:var(--font-body);color:var(--muted);margin-bottom:16px}.next .button{width:100%;margin-top:8px}.order-summary{display:flex;justify-content:space-between;font-size:var(--font-body);border-top:1px solid var(--line);padding-top:16px;margin-top:16px}.active-note{font-size:var(--font-sm);color:var(--muted);background:var(--surface-sunken);padding:12px;border-radius:var(--radius-sm);line-height:1.6}.history-row{padding:16px 16px;border:1px solid var(--line);border-radius:var(--radius-lg);margin-bottom:12px;background:var(--surface);display:flex;justify-content:space-between;gap:12px;align-items:center}.history-row strong{display:block;font-size:var(--font-heading)}.history-row p{font-size:var(--font-sm);color:var(--muted);margin-top:4px}.history-row .earned{font-size:var(--font-title);font-weight:600}.finished-total{background:var(--soft);border-radius:var(--radius-lg);padding:24px;margin-bottom:16px}.finished-total .amount{margin-top:4px}dialog{border:1px solid var(--line);padding:24px;border-radius:var(--radius-lg);width:410px;max-width:calc(100% - 32px);color:var(--ink);}dialog::backdrop{background:var(--overlay)}dialog p{font-size:var(--font-body);color:var(--muted);margin:8px 0 16px}dialog .confirm-summary{padding:16px;background:var(--surface-sunken);border-radius:var(--radius-lg);margin:12px 0;font-size:var(--font-body)}dialog .confirm-summary strong{display:block;margin-bottom:4px}dialog .actions{padding:8px 0 0}.toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100% - 32px);background:var(--ink);color:var(--surface);border-radius:var(--radius-lg);padding:12px 16px;font-size:var(--font-body);z-index:10;}.toast:empty{display:none}[hidden]{display:none!important}@media(max-width:700px){header{padding:16px 16px}.app{padding:24px 16px 40px}h1{font-size:var(--font-kpi)}.heading>.demo{display:none}.identity .name{display:none}.offers{grid-template-columns:1fr;gap:16px}.tabs{gap:24px;margin-bottom:24px}.availability{padding:16px 16px}.active-layout{grid-template-columns:1fr}.amount{font-size:var(--font-display)}.offer-top,.payrow{padding-left:16px;padding-right:16px}.stats{padding:12px 16px}.route{padding:16px 16px 0}.actions{padding:16px 16px}.pickup-note{margin-left:16px;margin-right:16px}.bottom .location{font-size:var(--font-caption)}.view-head{align-items:baseline}.view-head h2{font-size:var(--font-title)}.view-head .sub{font-size:var(--font-caption)}.active-top{padding:16px}.next{padding:16px}.brand small{font-size:var(--font-caption)}.history-row{padding:16px}}@media(max-width:360px){.app{padding-left:12px;padding-right:12px}.tabs{gap:12px}.tab{font-size:var(--font-sm)}.stats{gap:16px}.bottom .demo{display:none}.offer-top,.payrow,.route,.actions{padding-left:16px;padding-right:16px}}
```

### Arquivo `crm/index.html`

```html
<!doctype html><html lang="pt-BR" data-app="mesa-crm"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f8f9f5"><title>Solution Delivery — CRM da plataforma</title><meta name="description" content="Central administrativa de estabelecimentos, entregadores e entregas."><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23303a31'/%3E%3Ccircle cx='16' cy='16' r='8.5' fill='none' stroke='%23f8f9f5' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='3.5' fill='%235f7656'/%3E%3C/svg%3E"><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="../shared/tokens.css"><link rel="stylesheet" href="../shared/identity.css"><script src="../shared/theme.js"></script></head><body><aside id="sidebar"><button id="drawer-close" class="drawer-close icon-button" aria-label="Fechar menu">×</button><div class="brand"><svg class="solution-mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="var(--ink)" stroke="none"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--bg)" stroke-width="2"/><circle cx="16" cy="16" r="3.5" fill="var(--accent)" stroke="none"/></svg><div class="brand-name"><strong>Solution</strong><span> Delivery</span><small>ADMINISTRAÇÃO</small></div></div><div class="nav-label">PLATAFORMA</div><nav id="nav" aria-label="Áreas administrativas"></nav><div class="sidebar-bottom"><span class="avatar">AC</span><div><strong>Ana Costa</strong><small>Administradora do sistema</small></div></div></aside><button class="drawer-overlay" id="drawer-overlay" hidden aria-label="Fechar menu"></button><main><header><button class="menu-toggle" id="menu-toggle" aria-label="Abrir menu" aria-controls="sidebar" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><div><strong>Central da plataforma</strong><span>São Paulo · Operação regional</span></div><span class="demo">Ambiente de demonstração</span><div class="appearance"><label class="theme-label" for="theme-choice">Tema</label><select id="theme-choice" aria-label="Tema da interface"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></div></header><div class="workspace"><div class="heading"><div><div class="eyebrow" id="eyebrow">CONTROLE DA OPERAÇÃO</div><h1 id="page-title">Visão geral</h1><p class="subtitle" id="subtitle">Toda a operação em um só lugar.</p></div><div id="heading-action"></div></div><div id="content"></div><footer>Dados ilustrativos · As alterações valem apenas nesta sessão.</footer></div></main><dialog id="dialog" aria-labelledby="dialog-title"><div class="dialog-top"><h2 id="dialog-title"></h2><button id="close" class="icon-button" aria-label="Fechar">×</button></div><div id="dialog-body"></div></dialog><div id="toast" role="status" aria-live="polite"></div><script src="app.js"></script></body></html>
```

### Arquivo `crm/style.css`

```css
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer;color:inherit}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--ink-muted);outline-offset:3px}svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}aside{position:fixed;inset:0 auto 0 0;width:240px;background:var(--surface);border-right:1px solid var(--line);padding:32px 24px;display:flex;flex-direction:column}.brand{display:flex;gap:8px;align-items:center;font-size:var(--font-kpi);letter-spacing:-1px;font-weight:750}.mark{width:34px;height:34px;border-radius:var(--radius-lg);background:var(--green);color:var(--surface);display:grid;place-items:center;font-size:var(--font-title)}.brand small{display:block;font-size:var(--font-caption);letter-spacing:1.8px;font-weight:500;color:var(--muted);margin-top:-4px}.nav-label{font-size:var(--font-caption);letter-spacing:1.6px;color:var(--ink-muted);margin:40px 12px 16px}nav{display:grid;gap:4px}.nav-button{display:flex;align-items:center;gap:12px;text-align:left;font-size:var(--font-body);padding:12px 12px;border:0;background:none;border-radius:var(--radius-sm);color:var(--muted);width:100%}.nav-button.active{background:var(--soft);color:var(--green);font-weight:600}.nav-button .badge{margin-left:auto;font-size:var(--font-caption);padding:0px 4px;background:var(--line);border-radius:var(--radius-sm)}.sidebar-bottom{margin-top:auto;border-top:1px solid var(--line);padding-top:24px;display:flex;align-items:center;gap:8px}.avatar{width:36px;height:36px;border-radius:var(--radius-lg);background:var(--line);display:grid;place-items:center;font-size:var(--font-caption);font-weight:600;color:var(--ink-muted)}.sidebar-bottom strong{font-size:var(--font-sm)}.sidebar-bottom small{display:block;font-size:var(--font-caption);color:var(--muted);margin-top:4px}main{margin-left:40px}header{display:flex;align-items:center;justify-content:space-between;background:var(--surface);padding:24px 32px;border-bottom:1px solid var(--line);gap:12px}header strong{font-size:var(--font-body)}header span:not(.demo){display:block;font-size:var(--font-caption);color:var(--muted);margin-top:4px}.demo{font-size:var(--font-caption);color:var(--ink-muted);border:1px solid var(--line);padding:4px 8px;border-radius:var(--radius-sm);background:var(--surface-sunken)}.workspace{padding:32px 32px;max-width:1550px;margin:auto}.heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px}.eyebrow{font-size:var(--font-caption);letter-spacing:1.6px;color:var(--muted);margin-bottom:8px}h1{font-size:var(--font-display);letter-spacing:-1px;font-weight:600;margin:0 0 8px;line-height:1.3}.subtitle{font-size:var(--font-body);color:var(--muted);margin:0}.button{border:1px solid var(--line);background:var(--surface);border-radius:var(--radius-sm);padding:8px 12px;font-size:var(--font-body);font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px}.primary{background:var(--green);color:var(--surface);border-color:var(--green)}.small{font-size:var(--font-caption);padding:4px 8px;min-height:32px}.date{font-size:var(--font-sm);color:var(--muted);border:1px solid var(--line);background:var(--surface-sunken);border-radius:var(--radius-sm);padding:8px 12px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:24px}.metric{padding:16px;border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--surface)}.metric:first-child{background:var(--soft);border-color:var(--line)}.metric label{font-size:var(--font-sm);color:var(--muted);display:flex;justify-content:space-between;align-items:center;gap:8px}.metric label svg{width:18px}.value{font-size:var(--font-kpi);letter-spacing:-1px;font-weight:600;margin-top:8px}.metric small{display:block;font-size:var(--font-caption);color:var(--muted);margin-top:4px}.dashboard-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:24px;margin-bottom:24px}.panel{border:1px solid var(--line);background:var(--surface);border-radius:var(--radius-lg);overflow:hidden}.panel-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:24px 24px;border-bottom:1px solid var(--line)}h2{font-size:var(--font-heading);font-weight:600;letter-spacing:-.2px;margin:0}.quiet-link{border:0;background:none;font-size:var(--font-caption);color:var(--green);padding:4px}.panel-body{padding:24px}.pipeline{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.pipeline-box{background:var(--surface-sunken);border-radius:var(--radius-sm);padding:16px 12px}.pipeline-box strong{font-size:var(--font-kpi);font-weight:600;display:block}.pipeline-box span{font-size:var(--font-caption);color:var(--muted);display:block;margin:4px 0 8px}.pipeline-line{height:4px;border-radius:var(--radius-sm);background:var(--ink-muted)}.pipeline-box:nth-child(2) .pipeline-line{background:var(--line-strong)}.pipeline-box:nth-child(3) .pipeline-line{background:var(--ink-muted)}.pipeline-box:nth-child(4) .pipeline-line{background:var(--ink-muted)}.pipeline-note{font-size:var(--font-caption);color:var(--muted);margin:16px 0 0}.pending-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}.pending-row:first-child{padding-top:0}.pending-row:last-child{padding-bottom:0;border-bottom:0}.pending-row strong{display:block;font-size:var(--font-body);font-weight:500}.pending-row span{font-size:var(--font-caption);color:var(--muted)}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;var(--surface)-space:nowrap}th{font-size:var(--font-caption);font-weight:500;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;background:var(--surface-sunken);padding:12px 16px;border-bottom:1px solid var(--line)}td{padding:16px 16px;border-bottom:1px solid var(--line);font-size:var(--font-body)}tr:last-child td{border-bottom:0}td strong{font-size:var(--font-body);font-weight:550}td small{display:block;color:var(--muted);font-size:var(--font-caption);margin-top:4px}.status{font-size:var(--font-caption);display:inline-flex;align-items:center;border-radius:var(--radius-sm);padding:4px 8px;background:var(--surface-sunken);color:var(--ink-muted)}.status.neutral{background:var(--surface-sunken);color:var(--ink-muted)}.status.pending{background:var(--surface-sunken);color:var(--ink-muted)}.status.paused{background:var(--line);color:var(--ink-muted)}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px}.filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.search{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);padding:8px 12px;display:flex;gap:8px;align-items:center}.search svg{width:17px;color:var(--muted)}.search input{border:0;outline:0;background:none;font-size:var(--font-body);width:210px}.filter{font-size:var(--font-body);border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);padding:12px 12px;color:var(--muted);max-width:100%}.result-count{font-size:var(--font-caption);color:var(--muted)}.crm-stages{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}.crm-stage{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:16px 16px;display:flex;align-items:center;justify-content:space-between;font-size:var(--font-body);color:var(--muted)}.crm-stage strong{font-size:var(--font-title);font-weight:600;color:var(--ink)}.empty{padding:32px;text-align:center;font-size:var(--font-body);color:var(--muted)}footer{font-size:var(--font-caption);color:var(--muted);margin-top:24px}dialog{border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;width:540px;max-width:calc(100% - 28px);max-height:85vh;color:var(--ink);}dialog::backdrop{background:var(--overlay)}.dialog-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px}.dialog-top h2{font-size:var(--font-title)}.icon-button{width:32px;height:32px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);font-size:var(--font-title)}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}.detail-grid dt{font-size:var(--font-caption);color:var(--muted);margin-bottom:4px}.detail-grid dd{margin:0;font-size:var(--font-body);overflow-wrap:anywhere}.field{display:block;font-size:var(--font-body);margin:16px 0}.field input,.field select,.field textarea{display:block;width:100%;padding:12px 12px;border:1px solid var(--line);border-radius:var(--radius-sm);font-size:var(--font-body);margin-top:4px;background:var(--surface);color:var(--ink)}.field textarea{min-height:84px;resize:vertical}.form-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:24px}.dialog-note{font-size:var(--font-caption);color:var(--muted);margin:0 0 16px}.note-list{margin:16px 0;display:grid;gap:8px}.note-item{background:var(--surface-sunken);border-radius:var(--radius-sm);padding:12px 12px;font-size:var(--font-body);overflow-wrap:anywhere}.note-item small{display:block;color:var(--muted);font-size:var(--font-caption);margin-bottom:4px}#toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:20;background:var(--ink);color:var(--surface);border-radius:var(--radius-sm);padding:12px 16px;font-size:var(--font-body);max-width:calc(100% - 30px)}#toast:empty{display:none}.summary-strip{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px;font-size:var(--font-sm);color:var(--muted)}.summary-strip strong{color:var(--ink);margin-left:4px}.read-only{font-size:var(--font-caption);color:var(--muted);margin-top:16px}.profile-top{display:flex;gap:12px;align-items:center}.profile-top .avatar{width:46px;height:46px;font-size:var(--font-heading)}.profile-top p{font-size:var(--font-sm);color:var(--muted);margin:4px 0}.danger{background:var(--surface-sunken);color:var(--ink-muted);border-color:var(--line)}@media(max-width:1200px){aside{width:210px;padding:24px 16px}main{margin-left:40px}.workspace{padding:24px 24px}header{padding:16px 24px}.dashboard-grid{grid-template-columns:1fr}.metric{padding:16px}.metrics{gap:12px}.sidebar-bottom small{font-size:var(--font-caption)}}@media(max-width:850px){aside{width:76px;padding:24px 12px}.brand>div,.nav-label,.nav-button span,.sidebar-bottom div{display:none}.brand{justify-content:center}nav{margin-top:40px}.nav-button{justify-content:center;padding:12px}.nav-button .badge{display:none}.sidebar-bottom{justify-content:center}main{margin-left:40px}.metrics{grid-template-columns:repeat(2,1fr)}.toolbar{align-items:flex-start;flex-wrap:wrap}.result-count{padding-top:8px}}@media(max-width:600px){aside{inset:auto 0 0 0;height:70px;width:100%;padding:8px 8px;border-right:0;border-top:1px solid var(--line);z-index:10;display:block}.brand,.sidebar-bottom,.nav-label{display:none}nav{display:flex;justify-content:space-around;margin:0;gap:4px}.nav-button{flex:1;flex-direction:column;gap:4px;padding:4px 4px;font-size:var(--font-caption)}.nav-button span{display:block;font-size:var(--font-caption)}.nav-button svg{width:19px;height:19px}main{margin-left:0;margin-bottom:40px}header{padding:16px 16px}.demo{font-size:var(--font-caption);padding:4px 8px}.workspace{padding:24px 16px}h1{font-size:var(--font-kpi)}.heading{align-items:start;flex-wrap:wrap;gap:12px}.heading .button{font-size:var(--font-sm)}.date{display:none}.metrics{gap:8px}.metric{padding:16px}.metric label{font-size:var(--font-caption)}.metric small{font-size:var(--font-caption)}.pipeline{grid-template-columns:repeat(2,1fr)}.panel-body,.panel-heading{padding:16px}.crm-stages{gap:8px}.crm-stage{padding:12px 8px;display:block;font-size:var(--font-caption)}.crm-stage strong{display:block;margin-top:8px}.search{width:100%}.search input{width:100%}.filters{width:100%}.filter{flex:1}.result-count{padding:0}.detail-grid{gap:16px}.summary-strip{gap:12px}td,th{padding:12px 16px}dialog{padding:24px}.dialog-top h2{font-size:var(--font-title)}}
```

### Arquivo `crm/app.js`

```javascript
const icons={overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',stores:'<path d="M3 9 5 3h14l2 6M4 10v11h16V10M9 21v-7h6v7M3 9c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0"/>',couriers:'<circle cx="8" cy="7" r="3"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M22 21v-3a6 6 0 0 0-5-6"/>',deliveries:'<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h9a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>'};const icon=x=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[x]||icons.overview}</svg>`;
const stores=[{id:1,name:'Cozinha da Vila',contact:'Marina Oliveira',email:'marina@example.com',phone:'(11) 99900-1001',city:'São Paulo',address:'Rua Aspicuelta, 210 · Vila Madalena',status:'active',channel:'Indicação',notes:[{text:'Acompanhamento da operação de almoço agendado.',date:'06/10/2026'}]},{id:2,name:'Burger do Bairro',contact:'Pedro Santos',email:'pedro@example.com',phone:'(11) 99900-1002',city:'São Paulo',address:'Rua Mourato Coelho, 480 · Vila Madalena',status:'active',channel:'Site',notes:[]},{id:3,name:'Cantina Harmonia',contact:'Camila Rocha',email:'camila@example.com',phone:'(11) 99900-1003',city:'São Paulo',address:'Rua Harmonia, 86 · Vila Madalena',status:'active',channel:'Indicação',notes:[]},{id:4,name:'Padaria Aurora',contact:'Lucas Almeida',email:'lucas@example.com',phone:'(11) 99900-1004',city:'São Paulo',address:'Rua Girassol, 315 · Vila Madalena',status:'onboarding',channel:'Contato comercial',notes:[{text:'Aguardando confirmação dos horários de coleta.',date:'06/10/2026'}]},{id:5,name:'Sabor de Casa',contact:'Julia Ferreira',email:'julia@example.com',phone:'(11) 99900-1005',city:'São Paulo',address:'Rua Wisard, 240 · Vila Madalena',status:'lead',channel:'Site',notes:[{text:'Interessada em entregas no jantar. Fazer contato.',date:'06/10/2026'}]},{id:6,name:'Bistrô Jardim',contact:'Rafael Lima',email:'rafael@example.com',phone:'(11) 99900-1006',city:'São Paulo',address:'Rua Fidalga, 90 · Vila Madalena',status:'paused',channel:'Indicação',notes:[]}];
const couriers=[{id:1,name:'Bruno Martins',phone:'(11) 98800-2001',vehicle:'Moto',status:'busy'},{id:2,name:'Carla Souza',phone:'(11) 98800-2002',vehicle:'Moto',status:'busy'},{id:3,name:'Diego Alves',phone:'(11) 98800-2003',vehicle:'Bicicleta',status:'available'},{id:4,name:'Patricia Nunes',phone:'(11) 98800-2004',vehicle:'Moto',status:'available'},{id:5,name:'André Ribeiro',phone:'(11) 98800-2005',vehicle:'Moto',status:'pending'},{id:6,name:'Luiza Melo',phone:'(11) 98800-2006',vehicle:'Bicicleta',status:'paused'}];
const deliveries=[{id:1048,store:1,client:'Marina Oliveira',destination:'Rua das Flores, 120 · Vila Madalena',courier:null,status:'waiting',fee:9.9,distance:2.4},{id:1047,store:2,client:'Pedro Santos',destination:'Rua Fidalga, 90 · Vila Madalena',courier:null,status:'waiting',fee:7.9,distance:1.8},{id:1046,store:3,client:'Camila Rocha',destination:'Rua Wisard, 240 · Vila Madalena',courier:1,status:'collecting',fee:12.5,distance:3.2},{id:1045,store:1,client:'Lucas Almeida',destination:'Rua Girassol, 315 · Vila Madalena',courier:2,status:'route',fee:12,distance:4.1},{id:1044,store:3,client:'Julia Ferreira',destination:'Rua Harmonia, 86 · Vila Madalena',courier:3,status:'delivered',fee:8.9,distance:2.7}];
const labels={active:'Ativo',lead:'Prospect',onboarding:'Em implantação',paused:'Pausado',available:'Disponível',busy:'Em entrega',pending:'Aguardando aprovação',waiting:'Aguardando entregador',collecting:'Em coleta',route:'Em rota',delivered:'Entregue'};const state={view:'overview',search:'',filter:'all'};const $=id=>document.getElementById(id),money=x=>x.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const esc=escapeHTML;
function pill(status){return `<span class="status s-${status} ${['lead','pending','waiting','onboarding'].includes(status)?'pending':['paused'].includes(status)?'paused':['busy','collecting'].includes(status)?'neutral':''}">${labels[status]}</span>`}function storeName(id){return stores.find(s=>s.id===id)?.name||'Estabelecimento indisponível'}function courierName(id){return couriers.find(c=>c.id===id)?.name||'Não atribuído'}function findEntity(kind,id){const array={store:stores,courier:couriers,delivery:deliveries}[kind];const entity=array?.find(x=>x.id===Number(id));if(!entity)throw Error('Registro não encontrado.');return entity}
function nav(){const names={overview:'Visão geral',stores:'Estabelecimentos',couriers:'Entregadores',deliveries:'Entregas'};$('nav').innerHTML=Object.entries(names).map(([v,name])=>`<button class="nav-button ${state.view===v?'active':''}" data-nav="${v}" ${state.view===v?'aria-current="page"':''} title="${name}">${icon(v)}<span>${name}</span>${v==='deliveries'?`<b class="badge">${deliveries.filter(d=>d.status!=='delivered').length}</b>`:''}</button>`).join('')}
function setView(view){if(!['overview','stores','couriers','deliveries'].includes(view))throw Error('Área inválida.');state.view=view;state.search='';state.filter='all';render()}
function render(){nav();const copy={overview:['CONTROLE DA OPERAÇÃO','Visão geral','Acompanhe parceiros, entregadores e entregas da plataforma.'],stores:['RELACIONAMENTO COM PARCEIROS','Estabelecimentos','Do primeiro contato à operação: acompanhe cada parceiro.'],couriers:['GESTÃO DA REDE','Entregadores','Aprove cadastros e acompanhe a disponibilidade da equipe.'],deliveries:['CENTRAL LOGÍSTICA','Entregas','Distribua coletas e acompanhe a operação entre os estabelecimentos.']}[state.view];$('eyebrow').textContent=copy[0];$('page-title').textContent=copy[1];$('subtitle').textContent=copy[2];$('heading-action').innerHTML=state.view==='stores'?`<button class="button primary" data-new="store">${icon('plus')}Novo estabelecimento</button>`:state.view==='couriers'?`<button class="button primary" data-new="courier">${icon('plus')}Novo entregador</button>`:'<span class="date">06 de outubro de 2026</span>';if(state.view==='overview')renderOverview();else renderListShell()}
function renderOverview(){const active=deliveries.filter(d=>d.status!=='delivered');$('content').innerHTML=`<section class="metrics" aria-label="Resumo da plataforma">${[[stores.filter(s=>s.status==='active').length,'Estabelecimentos ativos','stores',stores.length+' parceiros cadastrados'],[couriers.filter(c=>c.status==='available').length,'Entregadores disponíveis','couriers',couriers.filter(c=>c.status==='busy').length+' em entrega'],[active.length,'Entregas em andamento','deliveries',active.filter(d=>d.status==='waiting').length+' aguardando atribuição'],[money(deliveries.filter(d=>d.status==='delivered').reduce((s,d)=>s+d.fee,0)),'Fretes concluídos','overview','Total das entregas demonstrativas']].map(([value,label,i,note])=>`<div class="metric"><label>${label}${icon(i)}</label><div class="value">${value}</div><small>${note}</small></div>`).join('')}</section><div class="dashboard-grid"><section class="panel"><div class="panel-heading"><h2>Fluxo de entregas</h2><button class="quiet-link" data-nav="deliveries">Ver entregas</button></div><div class="panel-body"><div class="pipeline">${['waiting','collecting','route','delivered'].map(s=>`<div class="pipeline-box"><strong>${deliveries.filter(d=>d.status===s).length}</strong><span>${labels[s]}</span><div class="pipeline-line"></div></div>`).join('')}</div><p class="pipeline-note">Distribuição dos pedidos cadastrados nesta demonstração.</p></div></section><section class="panel"><div class="panel-heading"><h2>Precisa de atenção</h2><span class="status pending">${couriers.filter(c=>c.status==='pending').length+stores.filter(s=>s.status==='onboarding').length} pendências</span></div><div class="panel-body">${couriers.filter(c=>c.status==='pending').map(c=>`<div class="pending-row"><div><strong>${esc(c.name)}</strong><span>Cadastro de entregador</span></div><button class="button small" data-detail="courier:${c.id}">Revisar</button></div>`).join('')}${stores.filter(s=>s.status==='onboarding').map(s=>`<div class="pending-row"><div><strong>${esc(s.name)}</strong><span>Implantação do estabelecimento</span></div><button class="button small" data-detail="store:${s.id}">Ver parceiro</button></div>`).join('')||''}${!couriers.some(c=>c.status==='pending')&&!stores.some(s=>s.status==='onboarding')?'<div class="empty">Nenhuma pendência de cadastro.</div>':''}</div></section></div><section class="panel"><div class="panel-heading"><h2>Entregas em andamento</h2><button class="quiet-link" data-nav="deliveries">Ver todas</button></div>${deliveryTable(active)}</section>`}
function toolbar(options){return `<div class="toolbar"><div class="filters"><label class="search">${icon('search')}<input id="search" aria-label="Buscar registros" placeholder="Buscar nome ou pedido" value="${esc(state.search)}"></label><select id="filter" class="filter" aria-label="Filtrar por status"><option value="all">Todos os status</option>${options.map(s=>`<option value="${s}" ${state.filter===s?'selected':''}>${labels[s]}</option>`).join('')}</select></div><span class="result-count" id="result-count"></span></div>`}
function renderListShell(){const options={stores:['lead','onboarding','active','paused'],couriers:['available','busy','pending','paused'],deliveries:['waiting','collecting','route','delivered']}[state.view];const prefix=state.view==='stores'?`<section class="crm-stages" aria-label="Resumo do relacionamento">${[['lead','Prospects'],['onboarding','Em implantação'],['active','Parceiros ativos']].map(([s,l])=>`<div class="crm-stage">${l}<strong>${stores.filter(x=>x.status===s).length}</strong></div>`).join('')}</section>`:state.view==='couriers'?`<div class="summary-strip"><span>Disponíveis <strong>${couriers.filter(c=>c.status==='available').length}</strong></span><span>Em entrega <strong>${couriers.filter(c=>c.status==='busy').length}</strong></span><span>Para aprovação <strong>${couriers.filter(c=>c.status==='pending').length}</strong></span></div>`:'';$('content').innerHTML=prefix+toolbar(options)+'<div id="list"></div>';$('search').addEventListener('input',e=>{state.search=e.target.value;renderRows()});$('filter').addEventListener('change',e=>{state.filter=e.target.value;renderRows()});renderRows()}
function renderRows(){const q=state.search.trim().toLocaleLowerCase('pt-BR');const source={stores,couriers,deliveries}[state.view];const list=source.filter(x=>(state.filter==='all'||x.status===state.filter)&&[x.name,x.contact,x.client,x.id,x.city,state.view==='deliveries'?storeName(x.store):'',state.view==='deliveries'?courierName(x.courier):''].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(q));$('result-count').textContent=list.length+' registros';if(!list.length){$('list').innerHTML='<div class="panel empty">Nenhum registro encontrado. Ajuste a busca ou o filtro.</div>';return}if(state.view==='deliveries'){$('list').innerHTML='<section class="panel">'+deliveryTable(list)+'</section>';return}const store=state.view==='stores';$('list').innerHTML=`<section class="panel"><div class="table-wrap"><table><thead><tr><th>${store?'Estabelecimento':'Entregador'}</th><th>${store?'Contato':'Veículo'}</th><th>${store?'Origem':'Telefone'}</th><th>Status</th><th>Ações</th></tr></thead><tbody>${list.map(x=>`<tr><td><strong>${esc(x.name)}</strong><small>${store?esc(x.city):'#'+String(x.id).padStart(3,'0')}</small></td><td>${esc(store?x.contact:x.vehicle)}${store?`<small>${esc(x.email)}</small>`:''}</td><td>${esc(store?x.channel:x.phone)}</td><td>${pill(x.status)}</td><td><button class="button small" data-detail="${store?'store':'courier'}:${x.id}">${store?'Ver parceiro':'Ver perfil'}</button></td></tr>`).join('')}</tbody></table></div></section>`}
function deliveryTable(list){return list.length?`<div class="table-wrap"><table><thead><tr><th>Pedido / estabelecimento</th><th>Cliente</th><th>Entregador</th><th>Status</th><th>Frete</th><th>Ações</th></tr></thead><tbody>${list.map(d=>`<tr><td><strong>#${d.id}</strong><small>${esc(storeName(d.store))}</small></td><td>${esc(d.client)}</td><td>${esc(courierName(d.courier))}</td><td>${pill(d.status)}</td><td>${money(d.fee)}</td><td><button class="button small" data-detail="delivery:${d.id}">${d.status==='waiting'?'Atribuir':'Detalhes'}</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nenhuma entrega em andamento.</div>'}
function toast(message){$('toast').textContent=message;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').textContent='',3500)}function openDialog(title,html){$('dialog-title').textContent=title;$('dialog-body').innerHTML=html;if(!$('dialog').open)$('dialog').showModal()}
function details(kind,id){const x=findEntity(kind,id);if(kind==='store'){openDialog(x.name,`<div class="profile-top"><span class="avatar">${esc(x.name.slice(0,2).toUpperCase())}</span><div>${pill(x.status)}<p>${esc(x.city)} · ${esc(x.channel)}</p></div></div><dl class="detail-grid"><div><dt>Responsável</dt><dd>${esc(x.contact)}</dd></div><div><dt>Telefone</dt><dd>${esc(x.phone)}</dd></div><div><dt>E-mail</dt><dd>${esc(x.email)}</dd></div><div><dt>Endereço de coleta</dt><dd>${esc(x.address)}</dd></div></dl><form id="status-form"><label class="field">Etapa do relacionamento<select name="status">${['lead','onboarding','active','paused'].map(s=>`<option value="${s}" ${s===x.status?'selected':''}>${labels[s]}</option>`).join('')}</select></label><button class="button primary" type="submit">Salvar etapa</button></form><h2 style="margin-top:24px">Histórico de relacionamento</h2><div class="note-list">${x.notes.map(n=>`<div class="note-item"><small>${esc(n.date)} · Ana Costa</small>${esc(n.text)}</div>`).join('')||'<p class="dialog-note">Nenhuma anotação registrada.</p>'}</div><form id="note-form"><label class="field">Nova anotação<textarea name="note" required maxlength="500" placeholder="Registre um contato ou próximo passo."></textarea></label><button class="button" type="submit">Adicionar anotação</button></form>`);$('status-form').onsubmit=e=>{e.preventDefault();updateStoreStatus(x.id,new FormData(e.target).get('status'));details(kind,id)};$('note-form').onsubmit=e=>{e.preventDefault();const text=new FormData(e.target).get('note').trim();if(!text)return;addNote(x.id,text);details(kind,id)}}
else if(kind==='courier'){const assigned=deliveries.filter(d=>d.courier===x.id&&d.status!=='delivered');openDialog(x.name,`<div class="profile-top"><span class="avatar">${esc(x.name.split(' ').map(n=>n[0]).slice(0,2).join(''))}</span><div>${pill(x.status)}<p>Cadastro demonstrativo #${x.id}</p></div></div><dl class="detail-grid"><div><dt>Telefone</dt><dd>${esc(x.phone)}</dd></div><div><dt>Veículo</dt><dd>${esc(x.vehicle)}</dd></div><div><dt>Entregas em andamento</dt><dd>${assigned.map(d=>'#'+d.id).join(', ')||'Nenhuma'}</dd></div><div><dt>Entregas concluídas</dt><dd>${deliveries.filter(d=>d.courier===x.id&&d.status==='delivered').length}</dd></div></dl><p class="dialog-note">Aprovações e pausas afetam apenas os dados desta demonstração.</p>${x.status==='pending'?`<button class="button primary" data-courier-action="approve:${x.id}">Aprovar cadastro</button>`:x.status==='paused'?`<button class="button primary" data-courier-action="resume:${x.id}">Reativar entregador</button>`:x.status==='busy'?'<p class="read-only">O entregador está em uma entrega e não pode ser pausado agora.</p>':`<button class="button danger" data-courier-action="pause:${x.id}">Pausar entregador</button>`}`)}else{const available=couriers.filter(c=>c.status==='available');openDialog('Entrega #'+x.id,`${pill(x.status)}<dl class="detail-grid"><div><dt>Estabelecimento</dt><dd>${esc(storeName(x.store))}</dd></div><div><dt>Cliente</dt><dd>${esc(x.client)}</dd></div><div><dt>Coleta</dt><dd>${esc(stores.find(s=>s.id===x.store)?.address)}</dd></div><div><dt>Destino</dt><dd>${esc(x.destination)}</dd></div><div><dt>Entregador</dt><dd>${esc(courierName(x.courier))}</dd></div><div><dt>Frete / distância</dt><dd>${money(x.fee)} · ${x.distance.toLocaleString('pt-BR')} km</dd></div></dl>${x.status==='waiting'?available.length?`<form id="assign-form"><label class="field">Entregador disponível<select name="courier">${available.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.vehicle)}</option>`).join('')}</select></label><button class="button primary" type="submit">Confirmar atribuição</button></form>`:'<p class="dialog-note">Nenhum entregador disponível. Aguarde a liberação de um entregador.</p>':x.status==='delivered'?'<p class="dialog-note">Entrega concluída. Nenhuma ação pendente.</p>':`<button class="button primary" data-delivery-advance="${x.id}">${x.status==='collecting'?'Confirmar coleta':'Confirmar entrega'}</button>`}`);if($('assign-form'))$('assign-form').onsubmit=e=>{e.preventDefault();assignDelivery(x.id,Number(new FormData(e.target).get('courier')));details(kind,id)}}}
function updateStoreStatus(id,status){if(!['lead','onboarding','active','paused'].includes(status))throw Error('Status inválido.');findEntity('store',id).status=status;render();toast('Etapa do parceiro atualizada.');return{id,status}}
function addNote(id,text){if(typeof text!=='string'||!text.trim()||text.length>500)throw Error('Anotação inválida.');findEntity('store',id).notes.unshift({text:text.trim(),date:'06/10/2026'});toast('Anotação adicionada.');return{id,added:true}}
function courierAction(id,action){const c=findEntity('courier',id);if(action==='approve'&&c.status==='pending'||action==='resume'&&c.status==='paused')c.status='available';else if(action==='pause'&&c.status==='available')c.status='paused';else throw Error('Ação indisponível para este entregador.');render();toast('Cadastro do entregador atualizado.');return{id,status:c.status}}
function assignDelivery(id,courierId){const d=findEntity('delivery',id),c=findEntity('courier',courierId);if(d.status!=='waiting')throw Error('Entrega já atribuída.');if(c.status!=='available')throw Error('Entregador indisponível.');d.courier=c.id;d.status='collecting';c.status='busy';render();toast('Entregador atribuído à entrega #'+d.id+'.');return{id,courierId,status:d.status}}
function advanceDelivery(id){const d=findEntity('delivery',id);if(d.status==='collecting')d.status='route';else if(d.status==='route'){d.status='delivered';const c=findEntity('courier',d.courier);if(!deliveries.some(x=>x.id!==d.id&&x.courier===c.id&&x.status!=='delivered'))c.status='available'}else throw Error('Etapa não permite avanço.');render();toast('Entrega #'+d.id+' atualizada.');return{id,status:d.status}}
function newEntity(kind){const store=kind==='store';openDialog(store?'Novo estabelecimento':'Novo entregador',`<p class="dialog-note">O cadastro será adicionado à demonstração nesta sessão.</p><form id="new-form"><label class="field">${store?'Nome do estabelecimento':'Nome completo'}<input name="name" required maxlength="100"></label>${store?'<label class="field">Responsável<input name="contact" required maxlength="100"></label><label class="field">E-mail<input name="email" type="email" required maxlength="150"></label>':''}<label class="field">Telefone<input name="phone" type="tel" required maxlength="30"></label>${store?'<label class="field">Cidade<input name="city" value="São Paulo" required maxlength="80"></label><label class="field">Endereço de coleta<input name="address" required maxlength="200"></label>':'<label class="field">Veículo<select name="vehicle"><option>Moto</option><option>Bicicleta</option><option>Carro</option></select></label>'}<div class="form-actions"><button type="submit" class="button primary">${store?'Cadastrar prospect':'Cadastrar para aprovação'}</button></div></form>`);$('new-form').onsubmit=e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));for(const k in data)data[k]=data[k].trim();if(Object.values(data).some(v=>!v)){toast('Preencha os campos obrigatórios.');return}if(store)stores.push({...data,id:Math.max(...stores.map(x=>x.id))+1,status:'lead',channel:'Cadastro manual',notes:[]});else couriers.push({...data,id:Math.max(...couriers.map(x=>x.id))+1,status:'pending'});$('dialog').close();render();toast('Cadastro adicionado à demonstração.')}}
function handleClick(e){const b=e.target.closest('button');if(!b)return;try{if(b.dataset.nav)setView(b.dataset.nav);if(b.dataset.new)newEntity(b.dataset.new);if(b.dataset.detail){const [kind,id]=b.dataset.detail.split(':');details(kind,id)}if(b.dataset.courierAction){const [action,id]=b.dataset.courierAction.split(':');if(action==='pause'){const c=findEntity('courier',id);openDialog('Pausar entregador?',`<p class="dialog-note">${esc(c.name)} deixará de receber novas atribuições nesta demonstração.</p><div class="form-actions"><button class="button" data-detail="courier:${id}">Voltar</button><button class="button danger" data-confirm-courier="${id}">Confirmar pausa</button></div>`)}else{courierAction(Number(id),action);details('courier',id)}}if(b.dataset.confirmCourier){courierAction(Number(b.dataset.confirmCourier),'pause');details('courier',b.dataset.confirmCourier)}if(b.dataset.deliveryAdvance){advanceDelivery(Number(b.dataset.deliveryAdvance));details('delivery',b.dataset.deliveryAdvance)}}catch(error){toast(error.message)}}
$('nav').addEventListener('click',handleClick);$('content').addEventListener('click',handleClick);$('heading-action').addEventListener('click',handleClick);$('dialog-body').addEventListener('click',handleClick);$('close').onclick=()=>$('dialog').close();render();
if(document.modelContext?.registerTool){const tools=[{name:'assign_demo_delivery',description:'Atribui uma entrega demonstrativa aguardando entregador a um entregador disponível. Atualiza os mesmos dados do CRM. Não envia dados a outros apps.',inputSchema:{type:'object',properties:{deliveryId:{type:'integer'},courierId:{type:'integer'}},required:['deliveryId','courierId'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!Number.isInteger(input?.deliveryId)||!Number.isInteger(input?.courierId))throw Error('IDs devem ser inteiros.');return assignDelivery(input.deliveryId,input.courierId)}},{name:'add_demo_partner_note',description:'Adiciona uma anotação ao histórico de relacionamento de um estabelecimento demonstrativo.',inputSchema:{type:'object',properties:{storeId:{type:'integer'},note:{type:'string',minLength:1,maxLength:500}},required:['storeId','note'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!Number.isInteger(input?.storeId))throw Error('storeId deve ser inteiro.');return addNote(input.storeId,input.note)}}];for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{})}catch{}}
```

