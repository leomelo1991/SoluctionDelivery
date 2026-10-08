# Base de Franca–SP para apresentação a investidores

Todos os dados são fictícios. Os volumes, valores de frete e evolução temporal ilustram funcionalidades; não representam clientes, receita, tração ou resultados reais. O nome da empresa exibido no painel identifica a demonstração.

## Conteúdo

Empresa isolada `investidores`, ambientada em **Franca–SP**, com 10 estabelecimentos (7 ativos e 3 leads), 14 entregadores (aprovados e pendentes), 5 regiões tarifadas (Centro, Estação, Cidade Nova, Vila Aparecida e Jardim Consolação) e 10 notas de CRM. Estabelecimentos, endereços de coleta e destinos estão em Franca; telefones fictícios usam DDD 16. **540 entregas: 528 concluídas e 12 ativas.** Histórico dos últimos 60 dias com crescimento simulado de 5 a 13 entregas concluídas por dia e 12 pedidos ativos em todas as etapas operacionais. Cada entrega tem valores de frete/repasse, eventos cronológicos e oferta quando atribuída. Oito entregadores têm um pedido ativo cada.

## Ativação na Vercel

No projeto da API, para **Production**, mantenha `ALLOW_DEMO_SEED=true`, `ALLOW_PRODUCTION_DEMO_SEED=true` e `DEMO_PASSWORD` (segredo de 12 a 128 caracteres). Acrescente `SEED_INVESTORS=true` e faça Redeploy usando o Build Command do repositório. As migrations precedem os seeds. Preview não modifica o banco.

O seed cria dados somente na empresa `investidores`; não adiciona entregas à empresa `demo`. Bases da versão anterior recebem uma atualização única da localização para Franca, mantendo quantidades, status, valores, datas e senhas. Execuções seguintes preservam os registros e não atualizam suas datas ou senhas. Após criar a base, remova `SEED_INVESTORS` e as variáveis do seed se não forem mais necessárias. Uma empresa existente com entregas ou sem a identificação do seed é recusada.

Localmente: `ALLOW_DEMO_SEED=true corepack pnpm seed:investors`, com `DEMO_PASSWORD` configurada no ambiente.

## Acesso e roteiro

Entre com empresa **investidores**, senha inicial configurada e uma destas contas: `admin@example.test`, `loja@example.test` ou `entregador@example.test`. A primeira entrada exige troca de senha. As contas são distintas das mesmas contas na empresa `demo`.

1. No administrador, mostre os pedidos ativos e o histórico. Selecione o período de 60 dias contado da criação da base para apresentar os totais simulados. O painel usa o dia atual por padrão, portanto os concluídos do dia deixam de aparecer quando a data muda.
2. Abra lojas e CRM para mostrar parceiros ativos, leads e acompanhamento comercial.
3. Compare tarifas por região e valores de frete e repasse. Esses valores não representam lucro líquido ou receita reconhecida da plataforma.
4. Na conta da loja, mostre pedidos e histórico limitados à própria loja.
5. No entregador, demonstre o aceite e a evolução do pedido atribuído até a conclusão. Essas ações modificam os dados da demonstração; repetir o seed não desfaz as alterações.

Não utilize telefones ou endereços fictícios para despachar entregas reais. O seed não chama provedores de rotas nem envia mensagens.
