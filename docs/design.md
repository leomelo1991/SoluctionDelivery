# Design system

Solution Delivery usa Manrope hospedada no frontend, números tabulares e uma paleta de azul profundo, verde e neutros frios. Os tokens ficam em `packages/ui/src/styles.css`; o layout operacional em `apps/web/src/styles.css` e a composição visual em `apps/web/src/design.css`. Tema inicial claro; escuro e sistema persistem como preferência visual. Marca e favicon usam o mesmo símbolo de percurso.

## Navegação e hierarquia

Administração agrupa o menu em Operação, Rede de parceiros, Comercial e financeiro e Administração. O estabelecimento vê Operação e Gestão. O cabeçalho identifica empresa, perfil e página. A visão geral destaca um acesso real ao mapa, indicadores e totais por etapa; os números vêm da API, sem tendências ou metas inventadas. Estados vazios distinguem operação inicial, histórico sem resultados e filtros sem correspondência.

Desktop: sidebar de 260px e conteúdo até 1600px; drawer abaixo de 1024px, com Escape, retorno de foco, ciclo de Tab, fundo bloqueado e conteúdo inerte. Indicadores usam quatro colunas acima de 1200px, duas em telas menores e uma abaixo de 360px.

Celular: filtros empilhados, quadro de entregas em uma coluna e tabela de entregas apresentada como cartões com rótulos por campo. Tabelas de cadastros mantêm rolagem dentro do próprio componente. Diálogos tornam-se painéis inferiores com área segura e rolagem interna. A tabela mantém cabeçalhos acessíveis mesmo na apresentação móvel.

## Componentes e acessibilidade

Componentes compartilhados: Brand, Button, Field, Status, Card, Metric, Modal, Empty, Loading, ErrorState e Pagination. Estados sempre têm texto e marcador; aguardando usa amarelo, em rota/concluído usa verde. O carregamento tem indicador animado que respeita reduced-motion. Ícones decorativos ficam ocultos da árvore de acessibilidade.

Formulários possuem rótulos, estados inválidos e mensagens associadas aos campos. O login usa `username` e `current-password` para gerenciadores de senha; cadastros continuam com `new-password`. A senha pode ser mostrada por ação explícita. Senhas continuam excluídas dos rascunhos. Não há preenchimento de credenciais no código.

Foco visível, link para pular a navegação, área de toque de pelo menos 44px e fonte de 16px nos campos móveis. Desativação/pausa mantém confirmação e explicação do efeito. Ações, permissões e integração com a API permanecem nos componentes existentes.

## Validação

Executar build do frontend, ESLint e Prettier nos arquivos alterados. A suíte `tests/e2e/responsive.spec.ts` cobre larguras de 320, 390, 768, 1024, 1440 e 1920px; depende de PostgreSQL, Redis e configuração de testes. A verificação visual deve incluir login, visão geral, entregas, financeiro, drawer e diálogo nos temas claro e escuro. Build bem-sucedido não substitui a verificação em navegador.

O Mobbin não forneceu referências nesta revisão porque sua integração exigiu plano pago. O desenho é próprio, baseado na aplicação existente.
