# Plano de desenvolvimento — cobrança de estabelecimentos e repasses

Versão 1.3 — 08/10/2026

## 1. Objetivo e premissas

Implementar a cobrança pela logística e o pagamento aos entregadores, com três modalidades: saldo pré-pago, cartão por entrega e pós-pago. Recarga por cartão também está prevista.

Este documento propõe regras para a plataforma própria; não reproduz contratos ou sistemas internos de concorrentes. Não depende de integração com iFood, 99 ou Del Match.

Premissa de escopo: o estabelecimento recebe a venda do produto diretamente. A plataforma cobra apenas a entrega e seus serviços. Cobrança do produto na porta, dinheiro físico, marketplace de produtos, parcelamento, transporte de passageiros e divisão de uma corrida entre modalidades ficam fora da primeira versão.

Stack não definida pelo usuário para este módulo: o desenho é independente de framework. Implementar na stack do projeto existente, usando banco relacional transacional, API e worker. Não criar outro backend apenas para o financeiro.

## 2. Modalidades e políticas iniciais propostas

| Modalidade | Como a loja paga | Quando pode solicitar | Como o entregador recebe |
| --- | --- | --- | --- |
| Pré-pago Pix | Recarga de créditos via Pix | Após confirmação e disponibilidade do recurso | Ganho após conclusão; repasse diário |
| Pré-pago cartão | Recarga via checkout tokenizado | Após captura e aprovação da política de risco | Mesmo fluxo; plataforma pode financiar o prazo de liquidação |
| Cartão por entrega | Autoriza o valor ao solicitar, captura segundo política do provedor | Após autorização válida; se não houver pré-autorização, após captura antecipada | Ganho após conclusão; repasse conforme caixa disponível e política publicada |
| Pós-pago | Fatura semanal, paga por Pix ou boleto | Após aprovação de crédito, dentro do limite e sem bloqueio | Ganho após conclusão; plataforma financia o intervalo até receber |

As datas e valores abaixo são propostas configuráveis, não compromissos já aprovados:

- Moeda BRL; valores em centavos inteiros; crédito sem parcelamento no MVP.
- Pré-pago como padrão de novas lojas. Recarga automática entra depois da versão inicial.
- Para lojas com entregadores dedicados, priorizar contrato semanal com mínimo por disponibilidade e acerto pelo realizado. Pós-pago é a modalidade recomendada para lojas aprovadas; pré-pago e cartão também podem financiar esse contrato.
- Pós-pago somente após aprovação administrativa registrada; limite definido por loja, sem valor universal.
- Fatura semanal, com corte na segunda às 00:00 em America/Sao_Paulo, cobrindo o intervalo anterior [segunda 00:00, segunda 00:00). Vencimento proposto três dias corridos após emissão, sujeito ao contrato e meio de pagamento.
- Repasse diário por Pix, em horário configurável, condicionado ao cadastro aprovado do entregador, elegibilidade e caixa provisionado. Mostrar a previsão antes de oferecer o serviço.
- Não alternar automaticamente a modalidade após falha: a loja confirma a alternativa e o preço.
- Uma entrega usa uma modalidade na versão inicial. Registrar a escolha no momento da contratação.

## 3. Preço e separação de recursos

Guardar um snapshot da cotação: preço cobrado da loja, remuneração do entregador, tarifa da plataforma, adicionais, desconto, patrocinador do desconto, versão da regra e validade.

Exemplo ilustrativo: loja paga R$ 12, entregador ganha R$ 10, tarifa da plataforma é R$ 2. Os R$ 2 ainda suportam taxas do provedor e custos operacionais; não são lucro líquido.

O gateway pode liquidar menos que R$ 12 devido a tarifas. Registrar bruto, taxas, líquido e data prevista de liquidação separadamente. Taxas devem ter responsável definido e informado. Gorjetas, se incluídas depois, exigem lançamento separado.

Preço da loja e ganho oferecido ao entregador são compromissos distintos. Não recalcular silenciosamente valores já aceitos. Espera, retorno, alteração de destino ou nova tentativa precisam de evento e regra explícitos; extras acima do autorizado exigem confirmação ou financiamento identificado.

## 4. Fluxo de pré-pago

1. Loja escolhe valor de recarga; backend cria uma intenção com chave de idempotência.
2. Pix usa cobrança identificável; cartão usa checkout/campos seguros do provedor. Backend armazena token e referência, nunca PAN ou CVV.
3. Webhook autenticado é persistido antes da resposta de sucesso e processado pelo worker. Redirecionamento do navegador não confirma pagamento.
4. Confirmar valor, moeda, estabelecimento e referência. Consultar o provedor quando houver ambiguidade.
5. Liberar créditos uma única vez, segundo a política: Pix liquidado; cartão capturado com caixa provisionado e critérios de risco, ou após liquidação. Mostrar crédito pendente enquanto não elegível.
6. Ao contratar entrega, reservar o total atomicamente. Saldo disponível = créditos utilizáveis menos reservas ativas.
7. Ao concluir, consumir reserva, registrar cobrança da entrega e ganho do entregador na mesma transação local.
8. Cancelamento libera reserva ou consome parcela prevista, remunerando o entregador quando aplicável.

Reembolso de recarga só pode atingir crédito livre e da origem correspondente, devolvendo pelo provedor ao instrumento original conforme capacidades. Crédito já consumido não vira reembolso automático. Manter origem/lotes de recarga para estorno parcial e contestação.

## 5. Fluxo de cartão por entrega

1. Cotação é aceita pela loja; solicitar autorização com referência única.
2. Validar prazo da autorização, autenticação exigida pelo provedor e eventual desafio no checkout.
3. Iniciar busca do entregador apenas após confirmação de autorização válida, ou captura antecipada quando o provedor não suportar autorização separada.
4. Capturar na confirmação da coleta, antes de permitir o início do transporte, como política inicial. Essa etapa reduz o risco de executar a entrega com captura recusada. O prazo de autorização precisa cobrir a operação.
5. Se captura estiver incerta ou falhar, consultar o provedor antes de repetir; suspender o avanço, oferecer troca confirmada de pagamento e aplicar a política de remuneração por deslocamento/espera.
6. Conclusão cria obrigação com o entregador independentemente da liquidação bancária do cartão.
7. Cancelamento anterior à captura cancela autorização; posterior à captura solicita reembolso total ou parcial conforme custos incorridos. Reembolso só é concluído após confirmação externa.

Não modelar dinheiro de cartão como disponível no banco ao capturar. Contestação pode ocorrer posteriormente e exige provisão e investigação. Não retirar automaticamente ganhos legítimos do entregador por uma contestação do estabelecimento.

## 6. Fluxo de pós-pago

1. Administrador aprova cadastro, limite, ciclo, vencimento e contrato; toda mudança gera auditoria.
2. Na solicitação, reservar exposição de crédito atomicamente.
3. Crédito disponível = limite aprovado menos dívida não quitada menos reservas ativas. Dívida inclui disponibilidade já prestada, entregas ainda não faturadas e faturas abertas ou vencidas, sem duplicar o mesmo valor. Reservar o compromisso fixo semanal ao confirmar o período, conforme seção 18.
4. Ao concluir, converter reserva em recebível da loja e criar ganho do entregador.
5. Worker fecha o período e vincula cobranças elegíveis à fatura, uma única vez. Emitir cobrança Pix/boleto com referência da fatura.
6. Pagamento confirmado é alocado à fatura e reduz a exposição; aceitar pagamentos parciais e exibir saldo remanescente.
7. Atraso bloqueia novas solicitações pós-pagas. Entregas em execução continuam; obrigações com entregadores permanecem.
8. Após quitação, recalcular elegibilidade. Bloqueios administrativos ou de fraude não são removidos automaticamente.

Fatura emitida é imutável. Correções usam nota de crédito/débito interna vinculada, com reflexo no saldo e na cobrança externa. Isso é um ajuste financeiro; emissão de documento fiscal exige integração e regras próprias.

Pagamento duplicado gera crédito excedente ou restituição controlada; nunca baixa duas vezes a mesma dívida. Uso de saldo pré-pago para quitar fatura exige ação explícita com trilha, sem débito oculto.

## 7. Repasse aos entregadores

- Estados do ganho: pendente de validação, disponível, reservado para repasse, pago ou revertido por ajuste fundamentado.
- Cada ganho pertence a um entregador e a uma origem identificada: entrega, turno dedicado, complemento de garantia ou ajuste. Guardar adicionais como itens separados e impedir dupla remuneração da mesma origem.
- Estados do repasse: criado, enviado, processando, pago, falhou, resultado desconhecido ou devolvido.
- Reservar ganhos antes de solicitar transferência; um ganho só entra em um repasse ativo.
- Transferência enviada não significa paga. Confirmar via provedor/webhook ou conciliação.
- Timeout mantém resultado desconhecido; consultar por referência antes de reenviar. Repetir somente com a mesma operação idempotente quando suportada.
- Falha definitiva libera reserva; devolução posterior registra novo lançamento e reabre a obrigação sem duplicação.
- CPF/CNPJ, titularidade e destino passam pelo cadastro e validação do provedor. Troca de destino exige autenticação reforçada, auditoria e tratamento das transferências em curso.
- Não prometer repasse imediato quando o dinheiro ainda está em recebíveis. Definir capital de giro e alertas de caixa antes de ativar cartão ou pós-pago em produção.

## 8. Modelo de dados

| Entidade | Responsabilidade |
| --- | --- |
| merchant_billing_profiles | Modalidades permitidas, ciclo, vencimento, bloqueios e política financeira |
| credit_limits / credit_limit_changes | Limite aprovado, histórico e responsável pela aprovação |
| ledger_accounts / ledger_transactions / ledger_entries | Contas, transações e partidas contábeis operacionais balanceadas |
| prepaid_lots | Origem da recarga, créditos consumidos e valores elegíveis a devolução |
| funding_reservations | Reservas de saldo ou crédito por entrega, expiração e encerramento |
| delivery_financials | Snapshot de preço, modalidade, entrega e ganho contratados |
| payment_intents / payment_attempts | Cobranças, autorização, captura, liquidação e tentativas |
| receivables / invoice_items / invoices | Dívida da loja, agrupamento e documentos de cobrança |
| payment_allocations | Alocação de recebimentos a faturas, inclusive parciais |
| courier_earnings / payouts / payout_items | Ganhos, lotes de repasse e vínculo exclusivo |
| refunds / disputes | Reembolsos e contestações com origem e evidências |
| provider_events / outbox_events | Inbox de webhooks e entrega confiável de tarefas |
| reconciliation_runs / discrepancies / audit_logs | Conciliação, divergências e auditoria |

O ledger operacional usa partidas dobradas: toda transação tem débitos e créditos de mesmo total. Contas de crédito pré-pago e valores devidos a entregadores representam obrigações; saldo do estabelecimento não é receita da plataforma. Limite pós-pago é capacidade de contratação, não dinheiro existente. Validar o mapeamento contábil final com a contabilidade.

Saldo materializado pode acelerar consultas, mas só muda na transação do ledger e deve ser reconciliável. Não permitir edição direta do campo saldo pelo administrador.

Restrições: identificação única de eventos externos por provedor/conta; chave única por operação financeira; faturamento único de cada recebível; inclusão única de ganho em repasse ativo. Locks transacionais por carteira/limite e ordem consistente de bloqueio evitam gasto concorrente e deadlocks.

## 9. Arquitetura e confiabilidade

Módulos: Pricing, MerchantBilling, Wallet, Credit, Payments, Invoicing, CourierSettlement e Reconciliation. Serviços de aplicação coordenam repositórios e regras; adapter PaymentProvider isola o gateway.

Contratos do adapter: criar cobrança, autorizar, capturar, cancelar autorização, consultar cobrança, reembolsar, criar transferência e consultar transferência. Só expor funcionalidades homologadas no provedor escolhido.

Uma transação de banco não engloba a rede do gateway. Persistir intenção e outbox juntos; worker executa a chamada e reconcilia o resultado. Inbox deduplica eventos e preserva payload sanitizado. Processar eventos fora de ordem com transições válidas e consulta de estado externo, sem regredir uma cobrança liquidada por evento antigo.

Nunca manter lock de carteira durante uma chamada de rede. Operações críticas combinam transação local, chave idempotente, worker e reconciliação. Retentativas têm backoff e limite; falhas persistentes vão para fila de revisão.

## 10. API inicial

| Endpoint proposto | Operação |
| --- | --- |
| GET /merchants/me/billing | Modalidades, bloqueios, saldo e crédito disponível |
| GET /merchants/me/statement | Extrato paginado com origem e status |
| POST /merchants/me/topups | Iniciar recarga Pix/cartão |
| POST /delivery-quotes | Cotar preço e modalidade |
| POST /deliveries | Contratar e iniciar reserva/autorização |
| GET /merchants/me/invoices | Listar faturas e saldos |
| POST /merchants/me/invoices/{id}/payments | Criar tentativa de pagamento da fatura |
| POST /webhooks/payments/{provider} | Receber eventos autenticados |
| GET /couriers/me/earnings | Ganhos e disponibilidade |
| GET /couriers/me/payouts | Histórico e previsão de repasses |
| PATCH /admin/merchants/{id}/billing | Alterar política mediante permissão e auditoria |
| POST /admin/merchants/{id}/credit-decisions | Aprovar/revisar limite |
| POST /admin/financial-adjustments | Ajuste vinculado, com motivo e autorização |

POSTs financeiros aceitam Idempotency-Key. A mesma chave com payload diferente retorna conflito. Autorização deriva a loja/entregador do usuário autenticado; não confiar em IDs enviados pelo frontend. Webhook tem autenticação própria. Nenhum endpoint de pagamento pode marcar cobrança como paga apenas por requisição da loja.

## 11. Telas

Estabelecimento: saldo disponível/reservado/pendente; recarga; checkout seguro; seleção de modalidade na entrega; limite utilizado/disponível; faturas, vencimentos e pagamento; extrato e comprovantes. Descrever claramente créditos de cartão pendentes e bloqueio por atraso.

Entregador: ganho por entrega, pendente/disponível/em repasse, calendário previsto, histórico, falhas e cadastro de destino.

Administração: aprovar pós-pago, alterar limite, ver inadimplência, recebíveis de cartão, caixa projetado, fila de repasses, contestações e conciliação. Separar permissões de aprovação de crédito, ajuste financeiro e envio de repasse; exigir revisão adicional para ajustes e operações acima de limiar configurável.

## 12. Backlog e ordem de desenvolvimento

| Etapa | Entregas | Critério de conclusão |
| --- | --- | --- |
| 0 — Contratos e regras | Selecionar provedor, homologar recarga e repasses, definir tarifa/ciclo/risco | Sandbox funcional e confirmação comercial de suporte ao fluxo de créditos e pagamento a terceiros |
| 1 — Base financeira | Ledger, reservas, preço, contratos comerciais por loja/turno, inbox/outbox, auditoria e permissões | Transações balanceadas e sem duplicação sob concorrência; regras versionadas por contrato |
| 2 — Pré-pago Pix | Recarga, extrato, contratação, consumo/cancelamento e telas | Entrega completa financiada por recarga; devolução validada |
| 3 — Repasse | Ganhos, lotes diários, Pix, falhas, consulta e conciliação | Ganho pago exatamente uma vez ou pendência claramente identificada |
| 4 — Cartão | Checkout/token, recarga, autorização/captura por entrega, reembolso e disputa | Fluxos aprovados, recusados, incertos e contestados exercitados |
| 5 — Pós-pago | Limites, reservas, recebíveis, corte, faturas, parcial e bloqueio | Ciclo completo com pagamento e atraso, sem liberar limite antes de confirmar recebimento |
| 6 — Piloto | Alertas, painéis, operação e ajustes de parâmetros | Conciliação diária aprovada e caixa suficiente para compromissos assumidos |

As três modalidades permanecem no escopo. A sequência reduz dependências: construir o mesmo núcleo financeiro antes dos meios de cobrança. Repasse não depende de cartão e pós-pago, mas estes dependem de repasse e gestão de caixa para o piloto.

Planejar uma iteração por etapa, decomposta em tarefas de backend, frontend e validação. Não fixar datas sem conhecer código existente, equipe e aprovação do provedor. Os ciclos externos de homologação podem ser o caminho crítico.

## 13. Testes de aceitação obrigatórios

1. Webhook entregue dez vezes gera uma única recarga/baixa/transferência confirmada.
2. Duas entregas concorrentes não ultrapassam saldo ou limite disponível.
3. Cancelamento e conclusão concorrentes produzem um resultado financeiro coerente.
4. Timeout depois de o provedor aceitar pagamento/repasse não gera outra operação externa.
5. Evento antigo ou fora de ordem não apaga liquidação nem baixa dívida duas vezes.
6. Cartão autorizado com captura recusada não libera coleta como se estivesse pago.
7. Captura sem liquidação não aumenta caixa disponível; previsão de repasse considera esse intervalo.
8. Contestação após uso dos créditos gera exposição, restrição e caso operacional, mantendo o ganho legítimo do entregador.
9. Job de faturamento repetido não duplica fatura; testar corte, atraso do worker e entregas exatamente na fronteira do período.
10. Pagamento parcial reduz dívida apenas pelo valor confirmado; duplicado gera excesso controlado.
11. Fatura vencida bloqueia novas entregas pós-pagas e preserva o pagamento de entregas concluídas.
12. Transferência devolvida reabre a obrigação uma vez; destino alterado não modifica repasse em curso.
13. Refund parcial, reserva expirada e cancelamento com tarifa mantêm ledger balanceado.
14. Loja A não acessa extrato/fatura da loja B; entregador não acessa ganhos de outro usuário.
15. Conciliação recupera webhook ausente e detecta divergências entre bruto, taxa e líquido.

Executar testes unitários das regras, integração com banco real para concorrência, contratos do adapter e jornada ponta a ponta no sandbox. Não usar dinheiro real para teste sem procedimento específico de homologação.

## 14. Operação, caixa e liberação

Monitorar: idade da fila de webhooks, erros por operação, pagamentos de resultado desconhecido, reservas antigas, ganhos não pagos, dívida vencida, discrepâncias e caixa projetado.

Conciliação diária relaciona cobrança, liquidação, tarifa, reembolso, disputa e transferência por referências. Administrador pode reprocessar eventos, consultar gateway e registrar ajuste com motivo; não alterar estado externo por suposição.

Caixa mínimo operacional deve cobrir repasses e despesas que vencem antes dos recebimentos confirmados, somados a reserva de contingência definida pela gestão. Não estimar esse valor pelo limite total aprovado: usar exposição real e projeção dos ciclos. Dinheiro já devido a entregadores e créditos de lojas não são caixa livre para financiar outras obrigações.

Critérios para ativar produção: provedor suporta contratualmente recargas/créditos e repasses a terceiros; cadastro do recebedor aprovado; políticas publicadas; conciliação validada; testes críticos aprovados; capital provisionado; responsável e procedimento para falha/contestação. Liberar cada modalidade por feature flag e grupo de lojas. Suspender novas contratações não apaga obrigações em curso.

## 15. Decisões necessárias antes de codificar integrações

- Qual é o repositório e a stack desta plataforma?
- Qual provedor aprova o fluxo de cobrança e repasse, incluindo recarga por cartão?
- Liberar créditos de cartão na captura com financiamento, ou somente na liquidação?
- Qual tarifa, tratamento de espera/cancelamento e responsável pelas taxas do provedor?
- Qual ciclo/vencimento pós-pago e capital disponível para o intervalo?
- Qual rotina e prazo de repasse serão apresentados ao entregador?

Enquanto essas decisões são fechadas, desenvolver modelo, regras, ledger e adapter falso para validar cenários. A configuração do ambiente real depende das respostas e da homologação.

## 16. Referências técnicas consultadas

Documentação consultada em 08/10/2026; nomes de eventos e recursos devem ser confirmados no provedor efetivamente contratado.

- Asaas — Eventos para cobranças: https://docs.asaas.com/docs/webhook-para-cobrancas
- Asaas — Introdução a webhooks: https://docs.asaas.com/docs/sobre-os-webhooks
- Asaas — Captura de pré-autorização: https://docs.asaas.com/reference/capturar-cobranca-com-pre-autorizacao
- Pagar.me — Recebíveis: https://docs.pagar.me/reference/receb%C3%ADveis
- Pagar.me — Cobranças: https://docs.pagar.me/reference/cobran%C3%A7as-1

As referências sustentam a distinção entre autorização, captura, recebíveis, disponibilidade e eventos assíncronos. O documento não seleciona um gateway nem presume que todos suportam todas as modalidades para esse modelo comercial.

## 17. Contrato comercial por estabelecimento e capacidade por turno

Segundo o relato confirmado pelo usuário, a referência observada é um pacote semanal pré-pago, estimado por volume e capacidade, com remuneração fixa para o entregador. Quando saem menos entregas, a loja paga menos à plataforma, enquanto a plataforma mantém o fixo combinado com o entregador e precisa complementar a diferença com recursos próprios quando a receita não cobre essa obrigação. O mecanismo exato desse menor pagamento no pacote pré-pago — abatimento, devolução, crédito ou ajuste posterior — ainda não foi informado. Isso é uma observação do usuário, não uma regra da Del Match verificada documentalmente. A plataforma própria adotará componentes explícitos de disponibilidade e consumo para evitar essa diferença sem cobertura.

Separar três dimensões: plano comercial define quanto cobrar; modalidade financeira define como/quando receber; escala operacional define a capacidade reservada e efetivamente prestada. Pré-pago, cartão e pós-pago permanecem disponíveis segundo elegibilidade.

### 17.1 Cadastro do contrato

Campos: estabelecimento, versão, vigência, dias atendidos, timezone, intervalos dos turnos, volume previsto por turno, pico de pedidos por hora, quantidade de entregadores simultâneos dedicados, duração, área/raio de atendimento, nível de serviço, política de substituição, tarifa de plataforma, preço de disponibilidade e tarifa variável de entrega/adicionais.

Turno pode atravessar meia-noite. A exclusividade vale para o intervalo contratado e não implica que o entregador esteja dedicado à loja em todos os horários. Uma garantia de capacidade pode ser atendida por substitutos elegíveis conforme contrato, sem prometer um indivíduo específico.

Versionar condições comerciais com data de início; não alterar entregas ou turnos já contratados retroativamente. Volume previsto orienta orçamento; volume realizado gera cobrança apenas conforme a regra escolhida.

### 17.2 Formas de precificação suportadas

| Modelo | Cobrança | Regra essencial |
| --- | --- | --- |
| Por entrega negociada | Quantidade realizada × tarifa contratada, mais adicionais | Volume previsto negocia preço; não cria dívida sozinho |
| Híbrido | Tarifa da plataforma + disponibilidade dedicada + entregas/adicionais | Definir o que já está incluído na disponibilidade |
| Pacote com franquia | Preço do período com disponibilidade e entregas incluídas + excedentes | Especificar franquia, período, distância e preço do excedente |

Não somar todos os componentes obrigatoriamente: uma tarifa pode incluir outra. Usar componentes explícitos para evitar cobrança dupla. Franquia deve definir consumo em cancelamentos, múltiplas paradas e retorno; atualizar consumo atomicamente.

Fórmula do modelo híbrido, para um mesmo período: total da loja = tarifa da plataforma + disponibilidade contratada + entregas variáveis + adicionais − créditos/descontos. Quantidade esperada serve à simulação; cobrança utiliza fatos e compromissos previstos no contrato.

### 17.3 Remuneração do entregador dedicado

Configurar separadamente do preço cobrado da loja:

- Por entrega: soma dos ganhos das entregas.
- Fixo por turno: valor devido pela disponibilidade comprovada conforme condições.
- Fixo mais entregas: soma de componentes explicitamente contratados.
- Garantia mínima: total do turno = máximo entre garantia elegível e ganhos incluídos; complemento = máximo entre zero e garantia menos ganhos incluídos. Garantia não é somada integralmente a ganhos se o contrato usa esse modelo.

Definir início/fim, presença, faltas, substituição, cancelamento pela loja e disponibilidade parcial. Loja pode dever a disponibilidade mesmo com poucas entregas, se assim contratado. A remuneração efetiva de cada entregador e eventual crédito por capacidade não atendida usam registros auditáveis.

### 17.4 Efeito nos pagamentos e repasses

Pré-pago: reservar disponibilidade/pacote ao confirmar o turno/período e componentes variáveis ao solicitar entregas; consumir cada obrigação no evento previsto. Cartão: cobrar componentes fixos no aceite/renovação conforme consentimento e variáveis por entrega; não manter autorização indefinidamente para um contrato longo. Pós-pago: reservas de turnos e obrigações fixas também consomem limite, além das entregas, sem duplicar valores incluídos em pacote.

Ganhos por entrega seguem o fluxo existente. Turnos e complementos são apurados ao encerrar o turno, antes de ficarem disponíveis para repasse. Recalcular complemento pela remuneração elegível já contabilizada; alterações posteriores geram ajustes explícitos. Previsão de caixa inclui compromissos fixos mesmo se o volume ficar abaixo da estimativa.

### 17.5 Implementação e validação adicionais

Entidades adicionais: merchant_contracts, contract_versions, pricing_components, shift_templates, scheduled_shifts, courier_allocations, attendance_events, shift_settlements e allowance_usage. Contratos e escalas referenciam a mesma versão comercial. Registrar snapshot dos componentes na cobrança, e a origem de turno nos ganhos.

Adicionar telas de orçamento, aprovação de contrato, escala por turno, disponibilidade contratada versus realizada e demonstrativo de cobrança por componente. Endpoints administrativos de contratos/versões e de escalas têm autorização e auditoria próprias.

Para entregadores dedicados, começar com contrato semanal híbrido: mínimo pela disponibilidade e parcela variável, sem franquia na primeira implementação. Manter tarifa por entrega para operações avulsas. Pacote com franquia entra após o controle atômico do consumo estar validado. Não inferir número de entregadores apenas pela média diária: duração de ciclo e pico de demanda precisam entrar no orçamento; o dimensionamento inicial pode ser informado manualmente e depois calibrado com histórico.

Testar: contrato novo não altera cobranças antigas; entregador não ocupa duas escalas exclusivas sobrepostas; turno noturno atravessa meia-noite corretamente; garantia não duplica ganhos; disponibilidade não prestada produz ajuste previsto; cancelamento de turno libera/consome reserva corretamente; reservas de turnos e entregas respeitam saldo/limite conjunto; entrega incluída não recebe outra cobrança integral; complemento reprocessado não duplica repasse.

Referência esclarecida pelo usuário: pacote semanal pré-pago. Para o contrato próprio, ainda definir valores, composição do mínimo, remuneração exata por turno/semana, compromisso de capacidade e critérios de ausência/substituição. A seção 18 especifica a recomendação de cobrança e acerto; suas tarifas e prazos ainda são configuráveis.

## 18. Pacote semanal com mínimo de disponibilidade e acerto

### 18.1 Problema e decisão de desenho

Problema confirmado pelo usuário: a loja paga menos à plataforma quando há menos entregas, mas o valor fixo devido ao entregador permanece. Assim, o baixo volume pode deixar parte dessa obrigação sem cobertura e exigir recursos próprios da plataforma. Trocar pré-pago por pós-pago muda o prazo de recebimento, mas não corrige o preço insuficiente. O desenho recomendado é contrato semanal com mínimo pela disponibilidade efetivamente prestada e parcela variável apurada pelo realizado. O mínimo precisa ser aceito previamente pela loja; é uma proposta para a plataforma própria, não uma condição existente da referência observada.

Separar dois riscos: diferença comercial entre receita e custos, tratada pela precificação; intervalo de caixa entre pagamento dos entregadores e recebimento da loja, tratado por crédito e capital de giro. Não debitar automaticamente a diferença dos ganhos do entregador.

### 18.2 Composição e fórmula

- Mínimo semanal: preço dos turnos/capacidade contratados, com cobertura orçada da remuneração fixa, custos associados e margem definida. Não é automaticamente igual ao ganho do entregador.
- Parcela variável: entregas ou excedentes efetivamente cobrados, segundo contrato. Se uma entrega estiver incluída no mínimo/pacote, não cobrar o componente incluído novamente.
- Adicionais: espera, distância, retorno e outros itens aceitos.
- Ajustes: créditos por indisponibilidade não cumprida e descontos explicitamente aprovados.

Modelo inicial sem franquia: total apurado = mínimo pela disponibilidade prestada + tarifa variável × entregas elegíveis realizadas + adicionais − ajustes aprovados. Tarifa de plataforma pode estar embutida no mínimo ou em item separado; indicar a escolha no contrato e evitar duplicação.

Volume estimado orienta orçamento e dimensionamento; não substitui volume realizado na parcela variável. Menos pedidos não reduz automaticamente o mínimo quando a disponibilidade foi cumprida. Falta de entregador, redução de turno acordada ou cancelamento seguem regras específicas e comprovadas, nunca um desconto arbitrário.

Exemplo ilustrativo, sem representar preços da Del Match:

| Item | Orçamento da semana | Apuração com menor volume |
| --- | --- | --- |
| Disponibilidade cumprida | R$ 600,00 | R$ 600,00 |
| Entregas a R$ 2,00 | 100 × R$ 2,00 = R$ 200,00 | 60 × R$ 2,00 = R$ 120,00 |
| Total | R$ 800,00 | R$ 720,00 |

### 18.3 Pós-pago semanal recomendado

1. Aprovar loja, contrato versionado, capacidade por turno, limite e prazo.
2. Ao confirmar a semana, reservar exposição correspondente ao mínimo comprometido. Evitar outra reserva integral do mesmo mínimo por turno.
3. Cada turno prestado converte sua parcela da reserva em recebível; registrar remuneração fixa/garantia do entregador em obrigação independente.
4. Cada entrega reserva e consome apenas componentes variáveis não incluídos, respeitando o limite conjunto.
5. No fechamento, somar disponibilidade, consumo e ajustes; emitir demonstrativo detalhado e fatura com referências às origens. Valores já registrados no ledger não são lançados novamente ao faturar.
6. Pagamento confirmado baixa somente o valor recebido. Menor pagamento deixa saldo em aberto; não altera unilateralmente o contrato ou o total apurado.
7. Bloquear novos compromissos conforme atraso/limite, preservando entregas em curso e ganhos já devidos. Obrigações futuras já contratadas seguem condições de suspensão/cancelamento aceitas.

Repasse diário permanece proposta configurável. Se os entregadores recebem antes do vencimento da fatura, provisionar o intervalo integral, inclusive semanas consecutivas com recebimento atrasado.

### 18.4 Pré-pago semanal com acerto

1. Cobrar/receber o orçamento semanal e separar o mínimo comprometido da parcela variável estimada. Recebimento antecipado de serviço ainda não prestado não constitui automaticamente receita realizada.
2. Reservar o mínimo ao confirmar a capacidade; reconhecer o serviço conforme turnos prestados e regras de cancelamento.
3. Consumir a parcela variável conforme entregas reais. No exemplo, após receber R$ 800 e apurar R$ 720, liberar R$ 80 como crédito livre.
4. Crédito livre pode permanecer para a semana seguinte; eventual restituição segue a origem e confirmação do provedor. Não devolver parcela já devida pela disponibilidade cumprida apenas porque houve poucos pedidos.
5. Se o consumo superar o orçamento, solicitar complemento antes de novas obrigações; usar limite pós-pago apenas se já aprovado e com autorização explícita. Sem saldo/limite, impedir novos compromissos sem abandonar entregas em andamento.

### 18.5 Cartão para o pacote

Permitir pagamento do orçamento pré-pago por checkout de cartão. Aplicar as regras existentes de captura, liquidação e contestação; crédito aprovado não elimina necessidade de caixa. Para fatura pós-paga, pagamento por cartão é extensão opcional, dependente de homologação do provedor, consentimento e política de taxas; o MVP continua com Pix/boleto.

Débito recorrente da semana exige consentimento próprio e mecanismo homologado; não está automaticamente autorizado pelo cadastro de um cartão. Ajuste de menor consumo gera crédito livre ou reembolso elegível, sem alterar obrigação fixa já cumprida.

### 18.6 Implementação e aceitação

Adicionar weekly_settlements e itens vinculados a turnos/entregas, com estados aberto, em apuração, fechado e ajustado. Guardar estimado, comprometido, realizado, adiantamento recebido, total devido, crédito livre, saldo a cobrar e versão do contrato. Fatura cobre o saldo a cobrar, sem duplicar adiantamento ou gerar novamente a dívida. Ajustes posteriores usam lançamentos vinculados e documentos de ajuste.

Telas: orçamento semanal, mínimo contratado, capacidade prestada, realizado, acerto, diferença e origem dos ajustes. Extrato da loja separa adiantamento, consumo fixo, consumo variável e crédito liberado. Painel da plataforma mostra receita/custos apurados e caixa projetado separadamente.

Testes adicionais: volume zero com disponibilidade cumprida mantém o mínimo; volume abaixo da previsão reduz somente a parcela variável; indisponibilidade comprovada aplica ajuste contratado; exemplo R$ 800/R$ 720 libera R$ 80 uma única vez; ultrapassagem exige cobertura; pagamento parcial mantém dívida; fechamento repetido não duplica fatura, créditos ou complementos; garantia do entregador permanece independente de menor pagamento pela loja.

Atualizar backlog: base financeira inclui reserva semanal e vínculo a turnos; pré-pago inclui acerto de adiantamentos; pós-pago inclui mínimo, demonstrativo semanal e faturamento do realizado; piloto valida preço mínimo e capital de giro com cenários de baixo volume.
