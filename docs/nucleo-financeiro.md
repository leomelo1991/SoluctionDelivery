# Núcleo financeiro — F2 em simulação

Acessos: `/admin/financeiro` e `/estabelecimento/financeiro`. Esta etapa permite testar saldo, compromissos e consumo sem movimentar dinheiro real. As tabelas impõem `mode = sandbox` e o único provedor implementado é falso. A ativação é explícita por empresa e por carteira; nenhuma migration ou seed ativa dinheiro, importa histórico ou muda o fluxo operacional de entregas.

## Uso

1. Um admin abre **Financeiro → Habilitar simulação financeira** e informa uma justificativa. Esse primeiro administrador recebe a capacidade `sandbox_manage`.
2. Seleciona a loja e ativa a carteira. Pode conceder/remover a permissão de outros admins ativos em **Permissões financeiras**. Outros admins consultam, mas não lançam valores. A loja consulta somente sua carteira; entregadores não acessam esse núcleo administrativo.
3. **Simular crédito** registra valor, referência de negócio única e resultado fictício (aprovação, recusa ou aceitação com resposta perdida). Criar a solicitação não aumenta saldo.
4. **Processar simulações pendentes** executa um lote de até cinco tarefas. Após resposta incerta, aguardar pelo menos dois segundos e processar novamente; a consulta recupera a aceitação já persistida no PSP falso. O crédito é lançado uma vez.
5. **Reservar mínimo semanal** seleciona versão aceita e segunda-feira. Reserva disponibilidade semanal + taxa de plataforma separada. Exige semana completa dentro da vigência; não faz rateio de semanas parciais nem repete o mínimo por turno. **Reservar entrega** usa a tarifa variável do contrato vigente na criação da entrega; sem contrato, usa o frete operacional registrado. Não soma as duas tarifas. Entregas concluídas não criam reservas novas.
6. **Encerrar reserva simulada** recebe consumo fictício, de zero até o reservado, e justificativa. O restante retorna ao disponível; repetição não gera liberação adicional. Esse consumo manual não é apuração de presença, faturamento ou remuneração efetivamente devida.
7. **Pausar novos compromissos** impede novos créditos e reservas da loja. Consultas, confirmação de créditos já solicitados e encerramento das reservas existentes continuam disponíveis.

Os extratos são paginados, com mais recentes primeiro, e distinguem variação do disponível e do reservado. A loja não recebe contas internas, custos de entregadores nem snapshots privados do contrato. O módulo mantém todos os valores explicitamente fictícios nas duas interfaces.

## Decisões técnicas

- BRL, valores individuais de até `999999999999` centavos. Banco e cálculo usam `BigInt`; a API devolve decimais em strings e o frontend formata sem converter agregados para `Number`.
- Contas: `cash:platform` (caixa fictício), `available:<loja>` (crédito livre), `reserved:<loja>` (comprometido), `revenue:platform` (consumo simulado). `expense`/`payable` são classes previstas para remuneração, sem lançamentos automáticos nesta etapa.
- Débitos são positivos; créditos, negativos. Toda transação posta tem no mínimo duas partidas e soma zero. Não persistem rascunhos incompletos: o estado draft existe somente dentro da transação de postagem.
- Crédito confirmado: débito em caixa fictício, crédito no disponível. Reserva: débito no disponível, crédito no reservado. Consumo: débito no reservado, crédito em receita fictícia. Liberação: débito no reservado, crédito no disponível. Esses são registros operacionais do sandbox, não contabilidade fiscal.
- Triggers diferidos validam equilíbrio e saldo pré-pago não negativo no commit. Triggers imediatos impedem editar, excluir ou mover partidas postadas. Contas também não podem ser reclassificadas depois de criadas.
- Transações Serializable com retry existente e lock por workspace/empresa serializam operações financeiras. A granularidade inicial prioriza consistência; deve ser medida e refinada antes de grande volume. Não há HTTP/PSP dentro do lock financeiro.
- A chave HTTP é persistida por empresa, independente do usuário, com hash de operação/payload. Referências naturais também são únicas: crédito por referência, semana por versão/data, entrega por ID e encerramento por reserva. Trocar usuário/chave HTTP não duplica o efeito. Payload conflitante com a mesma referência é rejeitado.
- Mínimo semanal e variável são reservas distintas. A tela manual não vincula automaticamente escala/solicitação de entrega a uma autorização financeira: essa integração entra nas etapas seguintes, após apuração e modalidade homologada.
- Mutações exigem sessão/CSRF/Origin e capacidade financeira, além do papel admin. A primeira ativação é uma decisão administrativa auditada de habilitar **simulação**; ela não autoriza cobranças ou pagamentos reais.
- Ledger, operação, reserva/crédito, auditoria e outbox são gravados na mesma transação. Inbox registra referência/hash de evento do PSP falso e aplica efeito idempotente. Eventos tardios não reabrem estados finais.

## Executor e recuperação

`FinanceTask` usa `FOR UPDATE SKIP LOCKED`, lease de 30 segundos, token por reclamação, tentativas e retentativa progressiva limitada a 60 segundos. Worker antigo não confirma uma tarefa reclamada por outro. Toda retomada consulta o PSP pela mesma referência; se ainda não existir recebimento no PSP falso, submete usando essa mesma referência. `FinanceSandboxReceipt` simula a persistência externa: uma resposta perdida não apaga a aceitação.

O endpoint `POST /finance/process` é exclusivo do gestor da simulação e reentrante; não representa webhook público nem scheduler de produção. Alternativa de execução limitada:

```sh
TENANT_SLUG=<empresa-de-simulacao> corepack pnpm --filter @solution/api finance:work
```

Cada execução processa até cinco itens. O script só usa o provedor falso e não roda no build. Para demonstração, o botão basta; para processamento contínuo de sandbox, agendar o comando em infraestrutura própria. A autenticação de scheduler/webhook externo e a homologação do PSP real continuam em F4/F5.

Não há API de exclusão do ledger. Somente manutenção direta pode apagar integralmente um workspace **sandbox**, em cascata — comportamento usado pela limpeza dos tenants de teste. Essa exceção deve ser removida/redesenhada para retenção de registros antes de qualquer modelo de produção; o schema atual proíbe esse modo. Ajustes após fechamento por lançamentos compensatórios com origem/evidência, em vez de edição, serão incorporados ao acerto F3.

## Implantação e validação

Aplicar `202610080003_finance_core` e `202610080004_ledger_entry_identity`, gerar Prisma/OpenAPI, publicar API e painel juntos. Nenhuma chave bancária é necessária para essa etapa. Migrations foram aplicadas e validadas apenas localmente; o deploy de produção segue o fluxo já existente.

Testes cobrem centavos/limites, fronteira semanal, capacidade financeira, escopo de loja/empresa, corrida de reservas, duplicação entre usuários, replay de eventos, confirmação incerta, retomada de lease, imutabilidade, transação desequilibrada, saldo negativo e distinção entre mínimo e variável. O cenário de uma reserva fictícia de R$ 800 consumida em R$ 720 libera R$ 80 uma vez; isso testa o mecanismo de liberação, não a apuração automática de uma semana. Playwright percorre ativação, crédito, confirmação, reserva de contrato e extrato em viewport móvel.

Próxima fase: F3 — apuração a partir de turnos, presença e entregas, fixo/variável/garantia e demonstrativo semanal. Ganhos do entregador, repasse Pix real, cartão e pós-pago ainda não são executados por este núcleo.

## Fechamento e ganhos

A evolução da simulação está documentada em [Fechamento e repasses simulados](fechamento-repasses-simulados.md). Inclui demonstrativos, remuneração, caixa e repasses fictícios; não ativa gateway, Pix ou cartão.
