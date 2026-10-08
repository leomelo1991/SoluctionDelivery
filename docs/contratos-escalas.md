# Contratos e escala — primeira entrega do módulo financeiro

Implementado na branch `feat/financeiro-contratos-repasses`. Esta etapa organiza condições comerciais e capacidade. Não gera dívida, débito, remuneração efetivamente devida ou transferência bancária. As entregas continuam usando as tarifas operacionais existentes.

## Fluxo

1. No CRM, abrir **Contratos e escala → Novo contrato**. Selecionar a loja, vigência de até um ano, área e regras de presença/substituição.
2. Informar mínimo semanal, taxa de plataforma apenas se não incluída e parcela variável por entrega. Configurar remuneração por entrega, fixa por turno, fixa + entrega ou garantia mínima.
3. Informar os turnos semanais, quantidade simultânea de entregadores e volume esperado por turno. Horários são de São Paulo; fim anterior ou igual ao início significa dia seguinte. Cada template representa uma ocorrência semanal. Templates sobrepostos são recusados: aumentar a capacidade do mesmo turno quando necessário.
4. **Calcular orçamento** mostra entregas previstas, horas-entregador, total da loja e, apenas ao administrador, remuneração e margem bruta estimadas. A previsão distribui as entregas igualmente entre os entregadores para simular garantia; o acerto futuro usará o realizado por pessoa.
5. Salvar rascunho, revisar e enviar proposta. Depois de enviada, as condições ficam fixadas. Para mudar, criar uma versão. A loja aceita no próprio painel, ou o administrador registra uma referência do aceite recebido externamente. Isso é registro de aceite, não integração com assinatura digital.
6. Depois do aceite, agendar cada ocorrência do turno. O horário precisa coincidir com o template e ficar dentro da vigência. Alocar entregadores aprovados nas vagas; intervalos parciais são permitidos.
7. Substituir preserva o intervalo já prestado e cria a alocação do substituto para o restante. Uma alocação futura pode ser liberada com justificativa. Cancelar turno futuro libera suas reservas. Ocorrências canceladas permanecem no histórico.
8. Após o intervalo do entregador, registrar minutos de presença (zero representa falta). Correções criam novos eventos com justificativa; o último registro é o vigente para consulta. A apuração monetária não é executada nesta etapa.

A loja vê apenas seus contratos/turnos, capacidade e preços, sem remuneração individual planejada nem margem interna. Entregadores não editam contratos ou presença administrativa nesta entrega.

## Regras e limites

- Um entregador não pode ocupar alocações sobrepostas; a mesma vaga também não pode ter dois ocupantes simultâneos. PostgreSQL protege ambas as restrições inclusive com requisições concorrentes.
- A exclusividade implementada é de **escala**. A distribuição de ofertas de entrega ainda segue o fluxo operacional existente; o bloqueio automático de ofertas de outras lojas durante um turno dedicado deve ser integrado antes de prometer despacho exclusivo.
- Aceites vigentes da mesma loja não podem ter períodos sobrepostos. Uma nova versão pode ser preparada antes, com vigência posterior à anterior. Renegociação antecipada com encerramento de compromissos futuros requer fluxo próprio posterior.
- Disponibilidade mínima é um valor semanal explícito. O sistema não aplica rateio automático em semanas incompletas, não importa ganhos históricos e não altera o preço de entregas existentes.
- Rascunhos de formulário são preservados na sessão; salvar o contrato limpa o rascunho correspondente.
- No MVP de escala, agendamento é por ocorrência; não há geração automática de toda a semana, confirmação de presença pelo app ou controle por GPS.
- Pico por hora, recomendação automática de dimensionamento, aprovação de presença pela loja, cálculo de acerto, reservas monetárias, faturamento e integrações bancárias continuam no backlog.

## Implantação

Aplicar a migration `202610080001_contracts_shifts` antes da API. Ela cria cinco tabelas com vínculos por empresa, constraints de integridade e extensão PostgreSQL `btree_gist` para impedir sobreposição. Confirmar permissão para a extensão no ambiente de destino; não remover as constraints para contornar falha de instalação. Migração foi aplicada somente no banco local durante o desenvolvimento.

Comandos usuais: `corepack pnpm db:generate`, `corepack pnpm db:migrate`, `corepack pnpm api:generate`, build da API/web. Novas tabelas não modificam registros de entrega antigos. Nenhum seed ou pagamento automático faz parte dessa migration.

## Validação

Unitários verificam mínimo semanal, volume, horas-entregador, fixo/garantia, turnos noturnos e sobreposição no fim da semana. Integração PostgreSQL verifica proposta/aceite, imutabilidade, isolamento, idempotência, conflito de alocações, substituição e registro de presença. O teste Playwright `tests/e2e/contracts.spec.ts` percorre orçamento no CRM, aceite na loja em viewport móvel, agendamento e alocação com API real.
