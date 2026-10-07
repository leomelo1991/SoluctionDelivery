# Entrega e evidências locais

## Implementado

Base de conhecimento derivada da referência e das decisões do usuário; monorepo NestJS/React/Prisma; PostgreSQL compartilhado com isolamento por empresa; três interfaces integradas; autenticação e usuários; CRM e auditoria; fluxo transacional de entregas; cotação por distância/região; acréscimos; adaptadores Mapbox/Google; app nativo Expo Android/iOS; componentes, temas e acessibilidade; execução portável e instruções de produção.

## Verificações

- 17 testes unitários: estados, cálculo monetário, arredondamento, idempotência, escopo de navegação, troca de destino, respostas concorrentes, validação da geometria, conexão Redis concorrente e transporte Upstash HTTPS.
- 16 testes de integração em PostgreSQL/Redis reais: escopo, concorrência, privacidade, aprovação, pausa, cotações, notas, sessão, provedores controlados e rate limit.
- 28 testes do cliente móvel, proxy, ofertas e localização: transporte nativo, repetição idempotente, sessão, respostas inválidas, URL e etapas/período.
- 5 jornadas Playwright: entrega integrada em três sessões; notas seguras e teclado; preço por distância com chuva; expiração e troca de perfil; primeira troca obrigatória de senha.
- Lint, TypeScript estrito sem any explícito, formatação, build e geração dos contratos OpenAPI.
- Migração aplicada; imagens Docker construídas; serviços iniciados e readiness confirmado.

Capturas locais: `test-results/admin-desktop.png`, `test-results/establishment-desktop.png` e `test-results/courier-mobile.png`. São artefatos gerados e ignorados pelo controle de versão. Dados das empresas de testes são removidos ao terminar as suítes.

## Experimentar

Endereço local: http://localhost:8080. Empresa: `demo`. Usuários: `admin@example.test`, `loja@example.test`, `entregador@example.test`. A senha inicial aleatória fica somente no arquivo `.env` local, variável `DEMO_PASSWORD`; cada usuário precisa trocá-la no primeiro acesso. A empresa demo contém cadastros e tarifas ilustrativos isolados dos dados reais.

A referência original foi preservada em diversos; seus anexos extraídos ficam em referencias. Para novas empresas, seguir provisionamento assistido e configuração de tarifas no guia operacional.

## Limites confirmados

Mapbox e Google exigem credenciais no servidor. Adaptadores e falhas foram testados com respostas controladas; chamadas reais não foram executadas sem credenciais. Tarifa regional e distância manual funcionam sem esses serviços.

O ambiente entregue é local. Publicação externa, domínio, HTTPS e infraestrutura redundante não foram contratados nem implantados. O guia explica produção e expansão; Compose em um nó não constitui alta disponibilidade. Não há pagamento, assinatura SaaS, GPS contínuo, cancelamento ou reatribuição ativa.

Workflow de CI foi incluído para executar as verificações em um repositório GitHub; nenhuma publicação ou execução remota foi realizada.

## Ampliação solicitada: Expo

Bundles Android/iOS exportados por Metro/Hermes, dependências verificadas com Expo e fluxo móvel validado em integração. APK/IPA assinados e instalação em dispositivo não fazem parte dessas evidências; exigem ferramentas/credenciais de build e validação física descritas no guia. A configuração local do app aponta para a API Docker.

Expo Go agora utiliza o proxy nativo do Metro para código e API pelo mesmo túnel. Validados resolução do endereço público, transporte de corpo/token, bloqueio de browser/admin, erro de backend e separação de builds standalone. A conexão real com Ngrok não foi validada nesta sessão com rede restrita.

Tela inicial do entregador ampliada com mapa nativo e marcador de moto, permissão de localização em uso e popups sequenciais. Os módulos nativos foram instalados; TypeScript, lint e exportação Android/iOS passaram. Validação em aparelho físico e conexão real do túnel continuam necessárias; nenhum túnel funcional foi alegado apenas com a exportação.

Ajuste do mapa e desempenho no app: disponibilidade compacta, área mínima do mapa, mapa mantido ao navegar, marcador memoizado sem atualização contínua da imagem, uso de posição recente do dispositivo, aviso de falha de carregamento e consultas periódicas apenas para dados operacionais. Histórico e resumo deixam de repetir consultas a cada cinco segundos. Validação visual e medição do desempenho no aparelho continuam pendentes.

Corrida integrada ao Início: etapas, retirada e conclusão no painel sobre o mapa, endpoint de navegação autenticado com destino decidido pelo servidor, traçado Google com GPS real, troca de coleta para destino após retirada e proteção contra respostas antigas. Foram adicionados 5 testes unitários API e 4 testes móveis, além do teste HTTP de navegação. Testes unitários e móveis passaram; integração e atualização Docker ficaram bloqueadas por permissões de conexão nesta sessão. Falta GOOGLE_MAPS_KEY no backend e verificação física do mapa, que permanece dependente do provedor Google no Expo Go Android.

Publicação preparada para GitHub e Vercel: configs dos dois projetos, proxy de API com sessão no mesmo domínio, pool PostgreSQL ajustável e suporte Upstash REST. Dois testes de configuração Vercel e 17 testes API passaram, além de builds locais. Destino solicitado: leomelo1991/SoluctionDelivery e equipe Vercel leo-dev10; criação de novo Neon autorizada. Nenhum envio, recurso cloud ou deploy foi concluído nesta sessão: escrita GitHub exige aprovação incompatível com a política never, e plugins Vercel/Neon estão indisponíveis até sua habilitação. Commit completo é entregue no bundle Git importável.
