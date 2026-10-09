# Pedidos externos — demonstração

Administradores e lojistas acessam **Pedidos externos** no menu. Os canais iFood,
99Food e Outro canal são simulações: não há autenticação, credenciais, webhook público,
consulta nem confirmação de pedidos junto às plataformas oficiais.

1. Clique em **Simular pedido**, selecione a loja e o canal e informe uma referência.
2. O pedido entra como **Aguardando revisão**, com cliente fictício e endereço inicial
   copiado da loja. Esse endereço é somente um preenchimento demonstrativo: revise-o.
3. **Revisar e criar entrega** abre o fluxo existente de cotação. A loja vinculada não
   pode ser trocada. Confira destinatário, endereço e tarifa, calcule e confirme.
4. A tela passa a mostrar número/status da entrega. **Ver entrega** abre os detalhes
   normais de despacho, acompanhamento e conclusão. A origem demonstrativa também é
   identificada no cartão da entrega. Nada é transmitido ao canal externo.

O pedido é persistido em `ExternalOrder`. A chave única é empresa + estabelecimento +
provedor + referência. Repetições recuperam o mesmo registro; concorrência na conversão
é protegida por transação serializável e atualização condicional. Criação da entrega,
consumo da cotação, vínculo do pedido e auditoria são atômicos. Uma falha reverte tudo.
A autorização deriva da sessão: o lojista só recebe pedidos de sua loja, o admin vê
sua empresa e o entregador não acessa a caixa de entrada externa. Todas as mutações
exigem autenticação e a proteção CSRF existente. O endpoint simulado aceita somente
os campos previstos; o banco restringe o modo a `demo`.

## Publicação e próximas integrações

Aplicar as migrations `202610090001_external_orders_demo` e
`202610090002_external_order_index_name` na API antes de usar a nova tela. O pipeline
Vercel de produção já executa `db:migrate`. Nenhuma variável ou chave de parceiro é
necessária para demonstrar este módulo.

Conectores oficiais exigirão aprovação/credenciais do parceiro, vínculo da loja externa,
adaptação e validação de payloads, autenticação de eventos e tratamento dos estados de
cancelamento/confirmação. Esses conectores não foram implementados nem homologados.
Não expor `/external-orders/simulate` como webhook nem usá-lo para pedidos reais.
