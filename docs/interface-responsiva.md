# Interface responsiva e formulários simplificados

A demonstração comercial usa os mesmos fluxos no painel administrativo e no estabelecimento, com ajustes de layout de 320 a 1920 pixels.

- Financeiro: saldos em destaque, cartões agrupados em duas colunas quando há espaço, demonstrativos e extrato em blocos legíveis, aviso de demonstração compacto.
- Navegação lateral com rolagem independente; cabeçalho preserva acesso ao menu, tema e saída. Nome extenso da empresa não empurra os controles para fora da tela.
- Filtros de período preservam os rótulos e reorganizam as datas no celular. Botões aceitam quebra de texto, têm área de toque de pelo menos 44px e mantêm foco de teclado.
- Modais viram painéis inferiores no celular, com rolagem própria, altura limitada à tela dinâmica e espaço para a área segura. Inputs de 16px evitam o zoom automático comum no iOS.
- Tabelas extensas mantêm rolagem dentro de seu contêiner. A página inteira não deve ganhar rolagem horizontal.

## Menos preenchimento

Ações financeiras, presença, substituição e cancelamento de escala não exigem justificativa digitada. Campos `reason` continuam aceitos pela API para compatibilidade; quando omitidos, ficam vazios. O histórico continua registrando ator, ação, data e dados alterados. Nenhuma justificativa fictícia é atribuída ao usuário.

Distância manual continua identificada como origem manual no orçamento, mas não exige justificativa. Restrições de modalidade, permissão, valores, CSRF e idempotência permanecem. O aceite de contrato continua explícito; descrição de adicional de preço e observações de entrega mantêm seus significados comerciais.

A referência de crédito é criada pelo navegador e persistida junto ao contexto da loja e do usuário, permitindo repetir a tentativa com a mesma referência até o sucesso. Não aparece mais como campo a preencher. A simulação de aprovação é a opção inicial.

## Verificação

`tests/e2e/responsive.spec.ts` verifica admin e estabelecimento nas larguras 320, 390, 768, 1024, 1440 e 1920. Confere dimensões dos modais, campos, ausência de overflow da página e uso do menu móvel. Capturas para inspeção visual ficam em `/tmp/ui-review`. A regressão financeira exercita ativação, crédito, reserva, fechamento e repasse sem os antigos campos de justificativa; testes de integração cobrem a API sem `reason` e compatibilidade de chamadas antigas.

Não há migration de banco ou variável nova. Publicar API e painel juntos: um frontend novo contra API antiga ainda poderá receber validações antigas de justificativa. As verificações no navegador emulado não substituem uma checagem em aparelhos físicos.
