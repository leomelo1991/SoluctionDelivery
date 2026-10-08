# Plano de implementação — contratos, cobrança e repasses

Status: planejamento, sem implementação do módulo e sem movimentação financeira.

Base: `main` em `3f4d2288edd469c505894f02d6663137883854af`. Branch: `feat/financeiro-contratos-repasses`. Análise em 08/10/2026 do [documento fornecido, versão 1.3](referencias/plano-financeiro-entregas-v1.3.md). O anexo é a referência funcional; este plano adapta suas 18 seções ao código existente. As referências comerciais e externas do anexo não foram verificadas nesta análise. O rascunho anterior `financeiro-repasses.md` permanece preservado, mas não define o escopo desta implementação.

## 1. Resultado esperado

A loja contrata logística: volume estimado, número de entregadores simultâneos, dias, turnos e área atendida. O sistema registra capacidade comprometida, disponibilidade prestada, entregas e ajustes; calcula o acerto da semana e administra recebimentos e obrigações com os entregadores.

Separar três regras versionadas:

1. **Contrato comercial:** preço da disponibilidade, tarifa de plataforma, entregas e adicionais.
2. **Financiamento:** pré-pago, cartão por entrega ou pós-pago, com reservas e limites.
3. **Remuneração e escala:** entregadores alocados, presença, fixo, variável ou garantia mínima.

A quantidade de entregadores significa capacidade simultânea por intervalo. Não basta contar os entregadores cadastrados na loja. O dimensionamento inicial será informado pelo gestor, apoiado por volume e pico por hora; recomendação automática por histórico fica para uma evolução.

Primeiro contrato dedicado: semanal híbrido, mínimo pela disponibilidade cumprida mais variável realizada, sem franquia. Operações avulsas continuam por entrega. Pré-pago Pix será a primeira modalidade integrada, seguido por repasse, cartão e pós-pago; todas permanecem no escopo. O contrato semanal pode ser financiado pelo pré-pago desde o início, sem esperar pelo pós-pago.

## 2. Diagnóstico da base atual

| Área              | O que existe                                                                  | Trabalho necessário                                                                         |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Backend           | NestJS, TypeScript, Node 24, módulos na mesma API                             | Módulos financeiros no mesmo backend; entrypoint separado para execução de tarefas          |
| Dados             | PostgreSQL, Prisma 7, migrations versionadas                                  | Entidades financeiras, constraints e migrations aditivas                                    |
| Valores           | Inteiros em centavos; snapshot de preço e remuneração em `Delivery`           | Separar orçamento, obrigação, financiamento, caixa e remuneração efetiva                    |
| Concorrência      | `atomic`, transação Serializable, retry P2034, `command` idempotente          | Chaves de operação independentes do usuário, locks de carteira/limite e inbox/outbox        |
| Entrega           | waiting → assigned → accepted → arrived → collected → delivered               | Estado financeiro independente; autorização, captura, cancelamento e expiração              |
| Integridade       | Índice SQL de uma entrega ativa por entregador e vínculo entre status/courier | Preservar essas regras e adaptar explicitamente a constraint ao cancelamento                |
| Cadastros         | Loja, entregador e usuário ligados por empresa                                | Contratos, capacidade, alocações temporais e presença; nenhuma ligação permanente implícita |
| Permissões        | Roles admin/establishment/courier, sessão, CSRF e Origin                      | Capacidades financeiras específicas e autorização própria para eventos externos             |
| Web               | React/Vite; operações, cadastros, tarifas e entregador                        | Contratos, escala, financeiro da loja, conciliação e fila de repasses                       |
| Mobile            | Expo/React Native; sessão e fluxo de entregas                                 | Ganhos, repasses, turnos e mensagens de pagamento/contratação bloqueados                    |
| API compartilhada | OpenAPI e tipos em `packages/contracts`                                       | Evolução compatível, geração de tipos e atualização dos clientes                            |
| Execução          | Vercel Functions; Redis TCP ou Upstash REST para rate limit                   | Executor durável de tarefas e agendamento; não presumir worker disponível no Redis atual    |
| Testes            | Unitários, integração PostgreSQL, mobile e Playwright na CI                   | Cenários monetários, concorrência, recuperação e sandbox do provedor                        |

Arquivos de integração: `apps/api/src/modules/{pricing,deliveries,transactions,dashboard}.ts`, `apps/api/src/http/{security,dto}.ts`, `apps/api/src/app.ts`, `apps/api/prisma/schema.prisma`, `apps/web/src/{main.tsx,pages}`, `apps/mobile/src`, `packages/contracts` e `.github/workflows/ci.yml`.

### Lacunas que afetam a ordem

- `SecurityGuard` verifica Origin antes de liberar endpoints públicos. Apenas marcar webhook como `@Public()` não funcionará; criar categoria autenticada própria com corpo bruto para assinatura, proteção contra replay e limites apropriados, sem enfraquecer sessão/CSRF existentes.
- A conclusão atual só atualiza dados operacionais. A criação de obrigações deve ocorrer na mesma transação local, com origem única, sem chamadas ao provedor nessa transação.
- Atualmente qualquer etapa diferente de waiting exige entregador na constraint `Delivery_status_link`. Um cancelamento antes da atribuição requer alteração dessa constraint, das transições, eventos, ofertas, filtros, DTOs e clientes.
- A coleta precisa de confirmação financeira quando a modalidade exige captura. Criar intenção de coleta/captura pendente e permitir `collected` somente após confirmação; não colocar `spawn`, HTTP ou gateway dentro de `command`.
- Não existe escala: o índice de entrega ativa impede duas entregas simultâneas, mas não impede turnos exclusivos sobrepostos. Acrescentar controle temporal independente.
- O build da Vercel já roda migrations de produção e enfrentou disputa de advisory lock. Planejar release de schema serializado antes de ativar flags; workers e rotinas financeiras nunca rodam no build.
- Seeds de investidores possuem histórico fictício. Não converter esse histórico automaticamente em recebíveis reais, autorizações ou repasses.

## 3. Arquitetura proposta

Criar `apps/api/src/modules/finance/` com serviços pequenos: contratos, escala, ledger, reservas, crédito, pagamentos, faturamento, acerto semanal, ganhos, repasses e conciliação. Regras puras de cálculo ficam em `apps/api/src/domain/finance/`.

Adapter em `apps/api/src/providers/payments/`: capacidades declaradas, ambiente/conta, cobrança Pix, autorização/captura, consulta, cancelamento, reembolso e transferência. Implementar primeiro um adapter falso determinístico para simular aprovação, recusa, timeout após aceite, duplicação e eventos fora de ordem. Uma função não suportada retorna indisponibilidade explícita; não simula confirmação.

Inbox e outbox persistem no PostgreSQL. Consumidor reclama lote com `FOR UPDATE SKIP LOCKED`, lease com expiração, contador de tentativas e retentativa agendada. Resultado e próximos eventos são gravados transacionalmente. Timeout externo preserva a referência e estado desconhecido até consulta; expiração do lease não autoriza reenviar uma transferência com outra referência.

A entrega de mensagens é pelo menos uma vez; os efeitos precisam ser idempotentes. Não prometer execução externa exatamente uma vez sem suporte contratual do provedor e reconciliação.

Decisão de hospedagem: worker Node persistente separado, reutilizando o código da API, ou invocações limitadas disparadas por scheduler/fila gerenciada compatível com Vercel. Preferência inicial: outbox PostgreSQL + executor limitado e agendado, com interface que permita worker persistente. A escolha final depende de latência, limites do plano Vercel e homologação; não introduzir BullMQ baseado apenas na presença de Upstash REST. Jobs agendados devem ser autenticados e reentrantes.

## 4. Modelo de dados por migração

Os nomes abaixo são propostas de modelos Prisma; o schema definitivo será revisado na fase correspondente. Todas as entidades têm `tenantId`, origem e vínculos compostos que impeçam atravessar empresas.

| Grupo         | Modelos propostos                                                                           | Invariantes                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Contratos     | MerchantContract, ContractVersion, PricingComponent, ShiftTemplate                          | Versão aceita imutável; vigência definida; componentes incluídos explícitos                       |
| Capacidade    | ScheduledShift, CourierAllocation, AttendanceEvent, ShiftSettlement                         | Intervalos [início,fim); capacidade simultânea; histórico de faltas/substituições; apuração única |
| Política      | MerchantBillingProfile, CreditDecision, FinancialPermission                                 | Modalidades aprovadas e limites auditados; bloqueios independentes                                |
| Núcleo        | LedgerAccount, LedgerTransaction, LedgerEntry                                               | Transação balanceada, BRL, postagem única; ajustes por reversão referenciada                      |
| Financiamento | PrepaidLot, FundingReservation, DeliveryFinancial                                           | Origem do crédito; disponível não negativo; snapshot da modalidade e compromissos                 |
| Provedor      | PaymentIntent, PaymentAttempt, ProviderEvent, OutboxEvent                                   | Referências únicas por provedor/conta/ambiente; payload sanitizado e estados monotônicos          |
| Fechamento    | Receivable, WeeklySettlement, WeeklySettlementItem, Invoice, InvoiceItem, PaymentAllocation | Recebível reconhecido uma vez; faturar agrupa e não reconhece dívida novamente                    |
| Entregadores  | CourierEarning, Payout, PayoutItem, PayoutDestinationVersion                                | Origem única; reserva exclusiva do ganho; destino congelado por transferência                     |
| Exceções      | Refund, Dispute, ReconciliationRun, Discrepancy                                             | Ajustes com origem, sem edição destrutiva e sem duplicar efeitos                                  |
| Evolução      | AllowanceUsage                                                                              | Franquia e consumo atômico somente após MVP híbrido                                               |

Ledger: transações draft/postadas; apenas postadas impactam saldo. Usar serviço único de postagem e constraints/triggers diferidas para validar soma de débitos/créditos por transação/moeda, e impedir alteração de partidas postadas. Não depender apenas de `CHECK`, que não verifica soma entre várias linhas. Documentar o plano de contas operacional antes da migration.

Valores unitários mantêm centavos inteiros. Para saldos e agregados, avaliar `BigInt` PostgreSQL/Prisma com serialização decimal explícita nos contratos, ou limites comprovados para inteiros seguros. Nunca converter BigInt silenciosamente para Number; não usar ponto flutuante para rateio. Definir arredondamento e destino dos centavos residuais.

Reservas de disponibilidade e de entregas seguem a mesma ordem de lock por empresa/conta. A reserva semanal do mínimo é pai das parcelas dos turnos; não reservar o mesmo mínimo de novo. Ao converter reserva em dívida, transferir exposição, sem somar ambas. O fechamento da fatura não duplica a dívida já reconhecida.

Para exclusividade de alocação, preferir constraint de exclusão PostgreSQL com intervalo temporal e entregador (avaliar `btree_gist` no Neon), mais serviço com locks consistentes para capacidade por turno. Se a extensão não estiver disponível, usar serialização por entregador com teste real de concorrência. Cancelar alocação libera apenas o intervalo correspondente.

## 5. Regras comerciais e exemplos de aceite

- Fórmula inicial: disponibilidade devida + entregas elegíveis × tarifa variável + adicionais − ajustes aprovados. Taxa da plataforma aparece uma única vez, embutida ou separada conforme versão do contrato.
- Exemplo do anexo: orçamento de R$ 800,00 = R$ 600,00 de disponibilidade + 100 × R$ 2,00. Com 60 entregas, apuração de R$ 720,00. Pré-pago libera R$ 80,00 de crédito livre uma vez; pós-pago cobra R$ 720,00 sem pressupor adiantamento.
- Volume zero não elimina o mínimo quando a capacidade foi prestada. Indisponibilidade ou falta usa regra contratual, evidência e ajuste auditado.
- Dimensionamento manual: dois entregadores simultâneos das 18h às 23h em seis dias representam 60 horas-entregador contratadas. Não são apenas dois cadastros nem 60 entregas. Substituições repartem a prestação e o ganho sem dobrar a capacidade cobrada.
- Remuneração fixa não acumula automaticamente o campo atual `courierPayoutCents` de cada entrega. Registrar política no compromisso: por entrega; fixo por turno; fixo + entrega; ou garantia. Nos modelos inclusivos, o valor operacional previsto não cria outro ganho monetário.
- Garantia: complemento = máximo(0, garantia elegível − ganhos incluídos). Se garantia for R$ 100 e ganhos incluídos R$ 70, complemento é R$ 30; com R$ 120 de ganhos não há complemento. Reapuração gera apenas diferença auditada.
- O mínimo de disponibilidade cobrado da loja e o fixo do entregador são compromissos distintos; a plataforma assume a diferença e o prazo de caixa contratados.
- Fechamento semanal usa segunda 00:00 no timezone do contrato e intervalos semiabertos. Persistir início/fim UTC e timezone; não usar `updatedAt` de entrega como data contábil de competência.

## 6. APIs e interfaces

Manter prefixo existente `/api/v1` e convenção `establishments` do projeto. Não criar um segundo endpoint concorrente para cotação: estender `POST /pricing/quotes` e `POST /deliveries` com versão comercial, modalidade, elegibilidade e resultado financeiro.

| Público          | Rotas propostas                                                                                          | Interface                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Admin            | `/admin/establishments/:id/contracts`, `/contract-versions`, `/scheduled-shifts`, `/courier-allocations` | Orçamento, aprovação, escala e presença                   |
| Loja             | `/establishments/me/billing`, `/statement`, `/topups`, `/weekly-settlements`, `/invoices`                | Consumo, créditos, mínimo, capacidade, acerto e pagamento |
| Admin financeiro | `/admin/credit-decisions`, `/financial-adjustments`, `/reconciliation`, `/payouts`                       | Crédito, ajustes, caixa e revisão de repasses             |
| Entregador       | `/couriers/me/shifts`, `/earnings`, `/payouts`, `/payout-destination`                                    | Turnos, ganhos, destino e repasses no web/mobile          |
| Provedor         | `/webhooks/payments/:provider`                                                                           | Sem interface de usuário; assinatura própria              |

IDs de loja/entregador são derivados da sessão nos endpoints `me`. Administrador seleciona entidade da própria empresa. Mutações usam Idempotency-Key e conflito para payload diferente; aprovações críticas têm capacidade específica, justificativa e revisão adicional conforme limite.

Tela de financeiro deve distinguir estimado, comprometido, devido, recebido, em transferência e pago. Não renomear o dashboard atual de fretes como caixa ou saldo. Projeção de margem não é dinheiro disponível. A interface de escala deve mostrar vagas contratadas, cobertas e faltantes por intervalo.

## 7. Backlog executável e dependências

Cada linha corresponde a um conjunto pequeno de PRs. Backend, UI e testes evoluem juntos; não juntar todo o módulo em uma única migration ou publicação.

| Fase                                | Trabalho                                                                                                           | Dependência                        | Saída verificável                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| F0 — Decisões e contratos técnicos  | Registrar ADRs de regras, plano de contas, estados, worker, provedor e capacidades; revisar permissões             | Este plano                         | Exemplos comerciais fechados; adapter falso; decisões pendentes identificadas                             |
| F1 — Contratos e capacidade         | Versões comerciais, orçamento, turnos, entregadores simultâneos, presença/substituição e UI administrativa         | F0 comercial                       | Contrato aceito preservado; sobreposição impedida; cenário 2 × 5h × 6 dias conferido                      |
| F2 — Núcleo financeiro              | Ledger balanceado, reservas semanais/por entrega, locks, permissões, inbox/outbox e executor de teste              | F0 técnico + vínculos F1           | Corridas concorrentes respeitam cobertura; postagem/replay sem duplicação                                 |
| F3 — Acerto e remuneração simulados | Apurar disponibilidade, entregas e garantia; extratos e demonstrativo semanal em sandbox                           | F1 + F2                            | R$ 800/R$ 720/R$ 80; fixo e garantia sem dupla remuneração; repetição idempotente                         |
| F4 — Pix pré-pago                   | Adapter sandbox, recarga, webhook, lotes, reserva/consumo, cancelamento/expiração e reembolso; UI loja             | F2 + F3 + gateway homologado       | Loja financia semana e entregas; saldo/limite não excedidos; pagamento externo conciliado                 |
| F5 — Repasse Pix                    | Destino validado, ganhos elegíveis, reserva/lote, execução, resultado desconhecido, falhas e devolução; web/mobile | F4 + política de caixa             | Ganho vinculado a um repasse ativo; confirmação única; reconciliação recupera evento ausente              |
| F6 — Cartão                         | Checkout seguro, recarga, autorização/captura na coleta, expiração, disputa e provisão; UI bloqueios               | F4 + F5 + capacidade do gateway    | Captura recusada não libera coleta; capturado não vira caixa liquidado; contestação mantém ganho legítimo |
| F7 — Pós-pago                       | Aprovação, limite conjunto, dívida, corte, fatura imutável, parcial, excedente e bloqueios; UI CRM/loja            | F3 + F5                            | Mínimo e variáveis faturados uma vez; atraso bloqueia novas obrigações; pagamento parcial preserva aberto |
| F8 — Piloto e operação              | Feature flags por empresa/loja/modalidade, alertas, conciliação, projeção de caixa e runbooks                      | Critérios da modalidade concluídos | Piloto com capacidade contratada, baixo volume, falhas e saldo projetado revisados                        |
| F9 — Franquia e automações          | Consumo da franquia, excedentes, recarga automática, recorrência consentida e dimensionamento sugerido             | Núcleo/piloto estáveis             | Franquia não duplica cobrança; novas capacidades homologadas individualmente                              |

F7 pode avançar em paralelo a F6 depois de F5 quando houver prioridade comercial por contratos semanais pós-pagos. Nenhuma data é fixada antes de dimensionar equipe, provedor e hospedagem. O primeiro incremento funcional recomendado é F1: orçamento/contrato/escala, com simulação do preço e remuneração, sem acionar pagamentos externos.

### Decomposição inicial da F1

1. ADR de componentes e vigência; fixtures numéricas aprováveis sem tarifas codificadas como padrão universal.
2. Migration de contratos/versões/componentes/templates e constraints por empresa.
3. Calculador puro de orçamento e remuneração, com rateio, mínimo, extras e garantia.
4. API de rascunho, simulação, aceite e nova versão; registro de quem aceitou e quando.
5. Migration e serviços de turnos, alocações, presença e substituição; transações de exclusividade.
6. Tela Contrato no cadastro da loja + escala administrativa + consulta da loja; estado rascunho versus vigente.
7. Tipos OpenAPI, testes de concorrência, fronteira temporal e jornada de contrato até escala.

## 8. Matriz mínima de testes

Preservar todos os cenários do anexo (§13, §17.5 e §18.6), com rastreabilidade por fase.

- F1: nova versão não altera passado; dois gestores não alocam o mesmo entregador em escalas exclusivas sobrepostas; turno cruza meia-noite; substituição e presença parcial.
- F2: débitos = créditos em toda postagem; restrição de alteração após postagem; duas reservas não excedem cobertura; operação repetida com chave igual retorna o mesmo resultado, payload diferente conflita; tentativa por outro usuário também não duplica a origem financeira.
- F3: zero/baixo/alto volume, disponibilidade não prestada, R$ 80 liberados uma vez; fixo inclusivo e garantia sem duplicar ganhos; adiantamento não reconhecido novamente ao faturar.
- F4: webhook repetido dez vezes, assinatura inválida, evento fora de ordem, persistência antes do ACK, cancelamento versus conclusão, expirador versus autorização, reembolso parcial e origem dos lotes.
- F5: timeout após aceite do provedor, lease expirado, retry com mesma referência, consulta antes do reenvio, falha definitiva e devolução posterior; conta destino alterada mantém snapshot do repasse em curso.
- F6: autorização vencida, captura recusada/incerta, aprovação tardia, crédito capturado versus liquidado, chargeback depois de consumo e provisão sem desconto automático do entregador.
- F7: corte exato de segunda, worker atrasado e repetido, pagamento parcial/duplicado, atraso, desbloqueio apenas da causa quitada; recebível não pode integrar duas faturas ativas.
- Todas: isolamento empresa/loja/entregador, limites de permissão, auditoria, compatibilidade API web/mobile, centavos/overflow, dados fictícios sem saída para gateway real.

Executar unitários das regras, integração PostgreSQL real para concorrência/constraints, testes de contrato do adapter, Playwright web, testes mobile e E2E sandbox. CI atual será ampliada; não depender só de mocks para dinheiro e exclusão temporal. Testes devem usar relógio controlável e banco isolado.

## 9. Migração, rollout e recuperação

- Flags inicialmente desligadas; lojas sem perfil financeiro continuam no comportamento atual até adesão explícita.
- Migrations aditivas e compatíveis com API anterior. Primeiro schema, depois serviços/worker, depois interfaces e flags por modalidade.
- Não importar entregas antigas como dívidas sem procedimento de corte/revisão. Snapshot operacional anterior não equivale a obrigação financeira aceita.
- Bases `demo` e `investidores` usam modo financeiro de simulação explicitamente isolado e adapter falso. Credenciais reais não podem ser escolhidas por esses tenants; controles de ambiente e tenant devem ser testados.
- Gateway e worker não dependem de seed ou build. Adotar executor de migrations serializado para produção; não desativar advisory locks em caso de concorrência.
- Desativar novas contratações não interrompe consultas, conciliação, processamento de eventos ou liquidação de compromissos já assumidos.
- Rollback de feature desliga novas operações; não apaga ledger. Reversões financeiras precisam de lançamentos vinculados. Versões de worker devem continuar compreendendo eventos existentes.
- Logs e alertas: idade de inbox/outbox, leases, falhas, desconhecidos, reservas antigas, ganhos vencidos, diferenças de conciliação, capacidade descoberta, dívida vencida e caixa projetado.

## 10. Decisões pendentes, sem bloquear todo o trabalho

| Decisão                        | Proposta do anexo / recomendação                                               | Bloqueia                                           |
| ------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| Escopo das vendas              | Apenas logística, produtos recebidos diretamente pela loja                     | Já definido pelo anexo                             |
| Stack/repositório              | Monorepo atual, NestJS/Prisma/PostgreSQL/React/Expo                            | Resolvido pela inspeção                            |
| Modelo dedicado inicial        | Semanal híbrido sem franquia; mínimo + variável                                | Configuração comercial da F1                       |
| Tarifas e capacidade           | Valores por loja e turno; dimensionamento inicial manual                       | Aceite de contratos reais; não bloqueia calculador |
| Presença/ausência/substituição | Eventos auditados e regras versionadas; definir elegibilidade e arredondamento | Apuração real F3                                   |
| Fixo versus garantia           | Configuração explícita por turno/entregador                                    | Ofertas/ganhos reais                               |
| PSP e conta titular            | Homologar recarga, cartão, reembolso e pagamento a terceiros por tenant        | Integração real F4–F7; adapter falso pode avançar  |
| Worker/scheduler               | Outbox PostgreSQL e executor durável compatível com hospedagem                 | Processamento externo em produção                  |
| Cartão e caixa                 | Definir disponibilidade na captura versus liquidação e capital provisionado    | F6 em produção                                     |
| Ciclo/vencimento               | Semana segunda 00:00; vencimento +3 dias é proposta configurável               | Contrato real e F7                                 |
| Repasse                        | Diário em horário configurável, sujeito à elegibilidade/capital publicados     | Piloto F5                                          |
| Revisão adicional              | Definir capacidades e valores que exigem segundo aprovador                     | Operações administrativas reais                    |

Não tratar relatos do anexo sobre outras plataformas como regras contratuais já verificadas. Não ativar automaticamente pagamento a terceiros, cobrança recorrente ou taxas não aceitas. A escolha do provedor não precisa impedir contrato, escala, cálculos, ledger e cenários simulados.

## 11. Entregáveis deste planejamento

- Branch exclusiva baseada na main atual.
- Cópia versionável do anexo v1.3.
- Mapeamento de diferenças com o repositório, backlog com dependências, critérios de aceite e plano de rollout.
- Nenhuma alteração em schema de produção, contas, pagamentos ou comportamento da aplicação nesta etapa.
