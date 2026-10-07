# Validação e aceite

## Camadas

Unitários: máquina de estados, mínimo, quilometragem excedente, percentuais cumulativos, fixos e arredondamento. Integração: PostgreSQL/Redis reais, autenticação, CSRF, vínculos, concorrência, cotação e histórico. Playwright: sessões independentes e fluxo completo nos três painéis, temas, persistência e viewport mobile.

Executar: pnpm lint; pnpm typecheck; pnpm test; pnpm test:integration; pnpm test:e2e; pnpm build. Testes de integração criam empresas próprias com slug de teste; não truncam tabelas de operação. Testes de navegador provisionam seu próprio cenário via script de fixture, sem credenciais de produção.

## Aceite

R01: nenhum perfil atravessa empresas ou troca ID para acessar outro parceiro. R02/R03: mesma entrega criada, aceita, coletada e concluída; uma reserva/entrega ativa por entregador; dois aceites têm um vencedor; recusa não cancela; repetição não duplica evento; conclusão libera disponibilidade.

R04: cadastros e notas persistem com autores e datas reais; pending/paused não operam; pausa de entregador ativo bloqueada. R05/R06: valores separados, preço congelado, acréscimos e vigência respeitados; cotação vencida/alterada rejeitada. R07: alternativa em falha técnica, ambiguidades explícitas e distância manual identificada.

R08: teclado, campos rotulados, diálogos, temas e telas mobile; erros não geram sucesso falso. R09: migração em banco vazio, build, readiness e inicialização Docker. Não afirmar validação real de Mapbox/Google sem credenciais e chamadas reais; mocks validam os adaptadores e falhas.

## Preservação ao retornar à janela

As jornadas da loja e do CRM verificam rascunhos após eventos de ocultação/retorno, com respostas bem-sucedidas, falhas temporárias HTTP 503 e recuperação. Cobrem solicitação de entrega, edição do cadastro e configuração de acréscimos. Uma atualização em segundo plano com dados já carregados exibe erro sem desmontar o formulário; expiração de sessão e troca de identidade continuam encerrando a área protegida. `E2E_WEB_PORT` permite executar o navegador em outra porta quando 5173 estiver ocupada; configure `APP_ORIGIN` com a mesma origem.
