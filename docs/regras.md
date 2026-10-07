# Regras de negócio e autorização

Administração controla apenas sua empresa. Estabelecimento acessa somente seus registros. Entregador acessa suas entregas e ofertas elegíveis. IDs enviados pelo navegador nunca definem a empresa autorizada.

Estados: `waiting → assigned → accepted → arrived → collected → delivered`. Ofertas abertas vão de waiting a accepted. assigned é reserva, não aceite. Recusa de oferta aberta é individual; recusa dirigida devolve a entrega a waiting e libera o entregador.

Uma entrega contém uma coleta e um destino. Uma pessoa possui no máximo uma entrega reservada/ativa. Concorrência é tratada por transações serializáveis, comparação de versão e índice único parcial. Estado, vínculo, disponibilidade e evento são gravados juntos.

Loja pode criar, atribuir e confirmar retirada. Entregador aceita/recusa, confirma chegada, retirada e conclusão. Administrador atribui; avanço operacional administrativo é correção, exige motivo e segue a máquina de estados. Nunca aceita em nome do entregador. Concluída não reabre.

Pausa de loja impede criação e ofertas abertas; reservas/entregas vinculadas continuam. Cadastro lead/onboarding/paused não opera. Aprovação pending/approved/paused é independente de disponibilidade offline/available/busy. Não pausar ou desativar entregador com entrega ativa.

Confirmações repetidas não duplicam eventos: mesma chave retorna a resposta gravada; outra chave com versão antiga retorna conflito. Recusa não cancela entrega. Oferta pública e reserva dirigida antes do aceite omitem destinatário, telefone, observações e endereço completo de destino, inclusive nas respostas da API. Os dados completos ficam disponíveis ao entregador somente após seu aceite.

Endereços digitados são snapshots próprios da entrega. Valores são em centavos; dinheiro exibido como BRL, datas em America/Sao_Paulo. Somatórios de fretes não são comprovantes de pagamento ou receita líquida.
