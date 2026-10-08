# Fechamento semanal, ganhos e repasses simulados

Esta entrega acrescenta a apuração F3 e um fluxo demonstrativo de repasses. **Não conclui as fases bancárias F4–F9 do plano**. Nenhum endpoint envia Pix, cobra cartão, valida titularidade de conta ou recebe webhook de um PSP. O modo do workspace continua obrigatoriamente `sandbox` no banco; o destino dos repasses só pode ser `sandbox`.

## Jornada disponível

1. Admin habilita a simulação em **Financeiro**, configura a carteira da loja e confirma crédito fictício.
2. Cria/aceita contrato, agenda os turnos e aloca entregadores na tela **Contratos**. Registra presença após o fim das alocações, inclusive zero quando houver falta.
3. Reserva o mínimo semanal e, antes da conclusão das entregas, reserva os componentes variáveis. Reservas de valor zero registram participação sem lançar partidas de zero, para permitir remuneração quando a entrega não tem tarifa para a loja. Entregas sem reserva não são convertidas retroativamente em dívida ou ganhos.
4. Depois de encerrados a semana e o último turno, usa **Fechar semana simulada**. O fechamento exige todos os turnos previstos cadastrados (ou explicitamente cancelados), presença de todas as alocações ativas e conclusão de todas as entregas reservadas do período.
5. A loja vê disponibilidade, tarifa da plataforma, variável, capacidade prestada e liberação de reserva. O admin vê também caixa, obrigações, custo e receita; os entregadores consultam seus ganhos no histórico web e mobile.
6. O admin cria um repasse simulado por ganho. Pode simular aprovação, recusa ou resultado incerto. `Processar repasse simulado` resolve o resultado; no cenário incerto, a primeira execução mantém a obrigação pendente e a segunda confirma. Devolução simulada restaura a obrigação e permite nova tentativa.

## Política de apuração versionada no demonstrativo

A política `sandbox_attendance_v1` é uma decisão **apenas de simulação**, não um aceite comercial para cobranças reais:

- Semana de segunda 00:00 a segunda 00:00 em São Paulo, integralmente dentro da vigência aceita. Turnos pertencem à semana de início; um turno noturno iniciado no domingo pode terminar depois do corte, e é preciso aguardar seu término.
- Disponibilidade devida = mínimo × minutos de presença / minutos de capacidade previstos nos templates. A tarifa de plataforma é integral. Turno cancelado ou vaga descoberta não gera presença. Registro ausente não equivale a falta: bloqueia a apuração.
- Valores em BigInt/centavos; divisões truncam para baixo, deixando o centavo residual com o pagador.
- Variável da loja usa as reservas existentes com a versão aceita e entrega criada na semana. Não soma o frete operacional novamente. Todas precisam estar concluídas; cancelamento de entrega e ajuste posterior ainda dependem das próximas fases.
- Cada entrega precisa corresponder a uma única alocação do seu entregador na hora da **criação da entrega**, dentro da semana. Uma entrega fora dessa regra bloqueia a apuração, em vez de inventar associação. Essa regra de demonstração precisa ser revisada no piloto para coleta tardia, redistribuição e operações entre semanas.
- Fixo do entregador é proporcional à presença no turno. Variável = entregas elegíveis × valor por entrega. Fixo inclusivo usa só fixo; fixo + entrega soma ambos; garantia usa o maior dos dois. Alocações do mesmo entregador no mesmo turno são agregadas antes de calcular a garantia.
- Ganho não depende de a plataforma ter caixa suficiente para pagá-lo. Caixa insuficiente bloqueia o repasse, sem reduzir o ganho.
- Um fechamento existente é retornado por reprocessamentos sem recalcular valores. Documento e ganhos são imutáveis. Presença apurada não pode ser alterada nem receber novo evento; correções financeiras com documentos vinculados permanecem pendentes, sem edição destrutiva disponível.

O exemplo R$ 800/R$ 720/R$ 80 é coberto por integração: R$ 800 reservados, 90% de presença elegível, consumo R$ 720 e liberação única de R$ 80. Outro teste confere a tarifa variável contratual e a garantia sem somar o frete operacional.

## Caixa e integridade

- Ganho: débito em despesa, crédito em obrigação do entregador.
- Confirmação simulada: débito na obrigação, crédito no caixa.
- Devolução simulada: débito no caixa, crédito na obrigação, com origem vinculada ao repasse.
- Caixa livre para novo repasse = caixa − créditos disponíveis/reservados de todas as lojas − repasses pendentes/incertos. Não usa crédito não consumido das lojas para cobrir remuneração.
- Locks por workspace e transações serializáveis protegem as operações. Índice parcial admite apenas um repasse pendente, incerto ou pago por ganho. Recusas/devoluções preservam histórico e permitem nova tentativa.
- IDs, valor, cenário e destino de um repasse são imutáveis; transições terminais não reabrem a mesma tentativa.
- `/finance/treasury` confere lançamentos balanceados e obrigação contábil contra ganhos menos repasses pagos. É conferência **interna**; não é conciliação de extrato bancário.

## API e limites

| Endpoint                                                    | Acesso                          |
| ----------------------------------------------------------- | ------------------------------- |
| `POST /finance/settlements` (`versionId`, `week`)           | Admin com capacidade financeira |
| `GET /finance/settlements?establishmentId=...&cursor=...`   | Admin / loja própria            |
| `GET /finance/earnings?courierId=...&cursor=...`            | Admin / entregador próprio      |
| `GET /finance/treasury`                                     | Admin                           |
| `POST /finance/payouts` (`earningId`, `scenario`, `reason`) | Admin com capacidade financeira |
| `POST /finance/payouts/:id/process` (`reason`)              | Admin com capacidade financeira |
| `POST /finance/payouts/:id/return` (`reason`)               | Admin com capacidade financeira |

Mutações usam `Idempotency-Key`; leituras usam `no-store`, isolamento por tenant e paginação de 50. A apuração admite até 2.000 reservas variáveis por semana; exceder o limite bloqueia com mensagem explícita. Não é executada no build nem por scheduler automático. Carteiras pausadas continuam permitindo fechar compromissos existentes.

## Publicação e dependências restantes

Migrations aditivas `202610080005_finance_settlements` , `202610080006_finance_payout_integrity` e `202610080007_zero_finance_reservations`, após as migrations anteriores da branch. API, web e mobile devem usar os contratos atualizados. Deploy não habilita a simulação em nenhum tenant automaticamente. Não há novas variáveis secretas para este incremento.

O fechamento F3 e o simulador não autorizam trocar o workspace para dinheiro real. Permanecem necessários:

- Provedor/conta titular definidos e credenciais de sandbox configuradas com segurança, capacidades de cobrança e transferência homologadas, assinatura de webhook e recuperação de timeout verificadas com o PSP.
- F4: Pix pré-pago real, lotes/origem, expiração, cancelamento e reembolsos.
- F5: destino versionado com titularidade, política/agenda de repasse, executor bancário com leases e reconciliação externa. O processador manual deste documento é somente simulação local.
- F6: checkout seguro, captura/expiração, liquidação, contestação e provisões.
- F7: crédito pós-pago aprovado, limites, recebíveis/faturas, pagamentos parciais, vencimento e bloqueios.
- F8/F9: correções por documentos vinculados, alertas, piloto e política comercial validada, franquia e automações consentidas.

Essas etapas não devem ser anunciadas como implementadas ou ativadas por causa deste merge.

## Isolamento dos testes de navegador

O Playwright inicia um servidor exclusivo de teste com namespace Redis `test-e2e-<uuid>` e renova apenas seus contadores de login de loopback antes de cada jornada. Não reutiliza API de desenvolvimento nem altera limites de produção. As regras dentro de cada jornada continuam iguais às de produção.
