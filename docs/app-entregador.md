# App do entregador — Expo

App nativo Android e iOS em `apps/mobile`, acrescentado por solicitação do usuário. Utiliza a API NestJS/Prisma existente e os mesmos usuários courier. O painel web do entregador permanece disponível.

## Funcionalidades

- Acesso por empresa/e-mail/senha e troca obrigatória da senha inicial.
- Sessão restaurada com SecureStore, validada na API antes de abrir dados privados.
- Aprovação/pausa e disponibilidade; ofertas abertas/dirigidas com remuneração e dados mínimos.
- Aceite e recusa com confirmação; chegada, retirada e conclusão na ordem definida no servidor.
- Endereço no Maps externo, ligação para o destinatário e etapas registradas.
- Histórico paginado por datas, quantidade e remuneração prevista, sem promessa de pagamento.
- Tema do sistema, áreas seguras, campos acessíveis, puxar para atualizar e tratamento de falhas.

Ofertas e entrega ativa são atualizadas a cada 5 segundos em primeiro plano; perfil a cada 20 segundos e detalhes da entrega a cada 10 segundos na tela Início durante uma entrega. Histórico e resumo do período carregam ao abrir a aba, mudar o período ou atualizar manualmente; não repetem consultas por temporizador. Ações não são enfileiradas offline. Aceites e etapas reutilizam a chave de idempotência após falha incerta, enquanto o app permanece aberto. Disponibilidade não é alterada automaticamente ao fechar o app; o entregador pode ficar indisponível quando não houver entrega reservada/ativa.

## Executar

Requisitos: Node 24, Corepack, Docker e Expo Go compatível com SDK 57 no celular.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm db:generate
docker compose --profile app up --build -d
cp apps/mobile/.env.example apps/mobile/.env
```

Edite `apps/mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://IP_DO_COMPUTADOR:8080/api/v1
APP_VARIANT=development
```

```sh
corepack pnpm mobile
```

Abra o QR code no Expo Go. No modo LAN, celular e computador devem alcançar a mesma rede; localhost no celular aponta para o próprio celular. No Expo Go, a API é encaminhada pelo Metro. Emulador Android padrão usa `http://10.0.2.2:8080/api/v1`; simulador iOS no Mac usa localhost. Em WSL/VM, configure encaminhamento da porta 8080/Metro no host ou use endereço HTTPS acessível; o IP interno da VM pode não ser acessível pelo celular. O proxy de desenvolvimento também encaminha a API do entregador pelo túnel do Metro.

O `.env` local preparado nesta máquina usa o IP da interface local; confira sua acessibilidade em outro dispositivo. Reinicie Expo após mudar a URL.

Acesso demonstrativo: empresa demo, entregador@example.test; senha inicial é DEMO_PASSWORD no `.env` da raiz. Não use credenciais administrativas: login móvel admite apenas entregadores. Cada usuário deve trocar a senha inicial.

## Expo Go em outra rede usando um único túnel

Com a API Docker rodando na porta 8080, execute na raiz do projeto:

```sh
corepack pnpm mobile:remote
```

O comando `mobile:remote` agora usa um agente Ngrok 3 independente com sua conta própria, em vez do túnel compartilhado do Expo que retornava `remote gone away`.

Configuração única: crie/acesse sua conta em https://dashboard.ngrok.com e copie o **authtoken** para `apps/mobile/.env`:

```dotenv
NGROK_AUTHTOKEN=SEU_AUTHTOKEN
```

Não coloque esse token em variável EXPO*PUBLIC*. O comando lê a configuração privada, verifica que a API local está pronta, baixa o binário oficial Ngrok 3 Linux somente na primeira execução para `.expo/tools` (ignorado), escolhe uma porta livre, abre o túnel da sua conta e inicia Expo Go automaticamente com o endereço público. Ao encerrar com Ctrl+C, encerra seus processos e remove a configuração temporária do agente. O token utiliza uma variável privada sem prefixo EXPO*PUBLIC*; não é incorporado ao bundle nem colocado na URL/QR code. `NGROK_BIN` pode apontar para um agente Ngrok 3 já instalado; outras plataformas devem usar essa opção.

O agente utiliza a conexão e os limites da sua conta; isso não garante sucesso se a rede bloquear Ngrok. O comando antigo continua disponível como `corepack pnpm mobile:tunnel` para o serviço integrado do Expo. Não repetir esse comando como solução para o erro persistente.

O app em modo de desenvolvimento dentro do Expo Go usa automaticamente o host do manifesto/QR code para `/api/v1`. O middleware do Metro encaminha os endpoints nativos do entregador para `http://127.0.0.1:8080`. Isso evita que o celular tente acessar o IP privado do WSL e permite usar o mesmo túnel para código e API. A API continua validando empresa, perfil, sessão, aprovação e versões das entregas. O proxy não aceita Origin de navegador, cookies ou rotas administrativas.

Se estiver executando a API diretamente na porta 3000, defina `EXPO_API_PROXY_TARGET=http://127.0.0.1:3000` em `apps/mobile/.env` antes de iniciar Expo. O destino do proxy só admite loopback HTTP. Não é um proxy aberto para outros servidores. Nenhuma configuração de HTTPS/cookies da API é alterada por esse modo.

Reinicie o processo Expo após atualizar metro.config.cjs. O comando também mostra o endereço seguro `exps://` para abrir manualmente no Expo Go. Se o QR code do Expo apresentar `exp://` com porta 443, use o endereço `exps://` impresso pelo comando. Se o agente da sua conta não conectar, o comando mostra a falha e encerra; confira o token e a conexão antes de testar. Sem um endereço alcançável, o Expo Go não pode abrir o app de outra rede. Os dois processos (API e Expo) devem ficar ativos.

APK/IPA e builds fora do modo de desenvolvimento usam `EXPO_PUBLIC_API_URL`; exigem API acessível pelo dispositivo. O proxy Metro não é incluído como servidor no APK.

## Build de teste e lojas

`eas.json` contém preview (APK interno) e production. Defina EXPO_PUBLIC_API_URL no ambiente EAS; nunca coloque chave de mapas ou outros segredos nessa variável pública. Preview usa APP_VARIANT=development para permitir API HTTP em rede de teste. Produção exige HTTPS.

Com conta Expo/EAS e identificadores comerciais ajustados em app.config.ts, execute dentro de apps/mobile:

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform all --profile production
```

Os comandos EAS são instruções operacionais; não foram executados nem geraram custos nesta entrega. iOS exige conta Apple e assinatura; publicação também exige credenciais, metadados e aprovação das lojas. Não há projectId ou conta comercial inventada no repositório. O preview iOS destina-se a dispositivos registrados; builds locais iOS requerem macOS/Xcode.

## Verificação

```sh
corepack pnpm --filter @solution/mobile check
corepack pnpm --filter @solution/mobile typecheck
corepack pnpm test:mobile
corepack pnpm test:integration
EXPO_PUBLIC_API_URL=https://api.example.test/api/v1 corepack pnpm --filter @solution/mobile build
```

O último comando exporta bundles Metro/Hermes Android/iOS para apps/mobile/dist; não gera APK ou IPA. A URL de exemplo serve para validar o build, não é um servidor publicado.

Testes de integração cobrem autenticação exclusiva courier, canais separados, primeiro acesso, rate limit, entrega completa, privacidade, idempotência e revogação. Testes do cliente cobrem conexão e regras auxiliares. Validar em celular antes de distribuir: teclado, tema, datas, retorno dos aplicativos externos, queda de rede, suspensão e conclusão concorrente. Não foi alegada execução em aparelho físico.

Fontes oficiais consultadas: [compatibilidade SDK](https://docs.expo.dev/versions/latest/), [monorepos](https://docs.expo.dev/guides/monorepos/) e [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

## Pedidos fictícios para testar os três painéis

Na empresa `demo`, o lote `demo-deliveries-v1` cria 15 entregas da loja vinculada a `loja@example.test`: oito aguardando aceite, uma direcionada ao entregador demo quando ele estiver disponível, três em etapas intermediárias com cadastros auxiliares e três concluídas no histórico do entregador demo. Os cálculos usam as tarifas e acréscimos vigentes. Eventos de simulação ficam identificados com justificativa administrativa; não representam entregas reais. Nenhuma senha é alterada.

```sh
ALLOW_DEMO_SEED=true corepack pnpm seed:deliveries
```

O comando exige empresa demo já provisionada, loja aberta, entregador aprovado e preços configurados. É proibido em produção e idempotente: repetir não adiciona outro lote. A execução é uma transação única e preserva entregas existentes. Se o entregador já estiver ocupado ou indisponível, a solicitação de demonstração correspondente fica aberta em vez de reservar outro pedido.

Lote aplicado neste ambiente: #75 a #89. No app, aceite a direcionada #83 e avance chegada → retirada → conclusão. Depois, as ofertas #75 a #82 ficarão elegíveis para o entregador disponível. O histórico contém #87 a #89. CRM e loja exibem também #84 (aceita), #85 (na coleta) e #86 (em rota). Os três cadastros auxiliares não possuem contas de login; suas entregas podem ser acompanhadas no CRM e na loja.

## Tela inicial com mapa e ofertas em popup

A área Início reserva altura para o mapa e utiliza um cartão compacto de disponibilidade para não consumir toda a tela. O mapa permanece montado ao trocar de aba, mas o GPS só acompanha a aba Início em primeiro plano. O mapa mostra um indicador de carregamento e, após 20 segundos sem carregar, oferece recarga sem atribuir a falha à internet. No iOS com Apple Maps, a disponibilidade usa onMapReady, pois onMapLoaded só existe no provedor Google Maps. A área solicita localização em uso e mostra uma moto somente quando recebe coordenadas recentes e válidas do aparelho. O botão Minha localização recentraliza o mapa; mover o mapa suspende o acompanhamento automático da câmera. Permissão negada, GPS desligado e falhas têm mensagens e tentativa de recuperação. Uma posição recente do dispositivo (até 30 segundos) pode antecipar o primeiro ponto, sem substituir uma posição mais nova do GPS. Mapa e marcador são memoizados; o marcador de moto deixa de atualizar sua imagem continuamente após a renderização inicial. A assinatura GPS é encerrada ao sair do mapa, suspender o app ou encerrar a sessão. Durante uma entrega, a posição atual é enviada ao endpoint autenticado de navegação para calcular o trajeto. Ela não é armazenada no banco, em eventos ou logs de requisição; a geometria fica apenas em memória enquanto a tela está ativa.

Ofertas elegíveis são consultadas em primeiro plano a cada cinco segundos e apresentadas em um popup, uma por vez, inclusive ao navegar pelo histórico ou pela conta. Ofertas dirigidas têm prioridade; as abertas seguem o código mais antigo do conjunto recebido. Aceitar e recusar executam a decisão diretamente; botões são bloqueados durante o envio. O aceite abre a entrega integrada ao Início; a recusa libera a próxima oferta. Uma decisão não é repetida por dados antigos em cache, e versões novas de uma oferta podem ser apresentadas novamente. Ofertas removidas desaparecem após a atualização; sessões, aprovação, indisponibilidade e entrega ativa mantêm seus bloqueios. Não há contagem regressiva fictícia nem recusa automática por tempo.

Este popup é um aviso dentro do aplicativo aberto. Notificações push com app fechado ou sobre outros aplicativos exigem uma implementação distinta e não foram acrescentadas neste pedido.

Dependências nativas compatíveis com Expo SDK 57: expo-location 57.0.20 e react-native-maps 1.27.2. Após baixar os módulos, reinicie Metro e permita localização no celular. Expo Go inclui suporte nativo para os dois módulos. Para APK Android, configure GOOGLE_MAPS_ANDROID_KEY no ambiente EAS com Maps SDK for Android habilitado e restrição pelo pacote/SHA-1 do app; iOS utiliza Apple Maps por padrão. Essa chave é diferente da chave privada de rotas usada no backend.

Fontes: [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/) e [react-native-maps no Expo](https://docs.expo.dev/versions/latest/sdk/map-view/).

Verificação desta mudança: 28 testes do cliente, gateway, seleção de ofertas e ciclo de localização passaram; lint sem erros. Após a instalação dos dois módulos nativos, typecheck e exportação dos bundles Android/iOS passaram. Os testes de localização utilizam adaptadores controlados; GPS e apresentação do mapa precisam ser verificados no aparelho. A geração de bundles não confirma uma conexão ativa com o túnel Ngrok.

O launcher da conta própria foi preparado e verificado localmente. A conexão pública permanece pendente da configuração de um authtoken válido do usuário; nenhum link conectado foi alegado sem essa validação.

O mapa do app utiliza Google Maps no Android e Apple Maps no iOS via react-native-maps. A configuração Mapbox de cotação na API não muda o mapa visual do app. Mapbox possui franquias de uso e cobrança acima delas; o SDK React Native Mapbox exige compilação de aplicativo próprio e não é incluído no Expo Go: https://rnmapbox.github.io/docs/install e https://www.mapbox.com/pricing.

Diagnóstico do mapa vazio no Expo Go Android: existe um relato aberto para SDK 57 com mapa Google vazio, logo/atribuição visíveis e nenhuma imagem carregada: https://github.com/expo/expo/issues/49323. O sintoma é compatível, mas não comprova a causa neste aparelho. A documentação Expo informa que react-native-maps não requer chave adicional no Expo Go; a chave GOOGLE_MAPS_ANDROID_KEY do projeto só entra no binário próprio compilado. O aviso de 20 segundos indica ausência de confirmação de carregamento, sem testar ou diagnosticar a internet. Logs do aparelho não foram obtidos nesta sessão.

## Corrida e mapa na mesma tela

A aba Entrega foi integrada ao Início. Após aceitar uma oferta, o mapa ocupa a área principal e um painel sobreposto apresenta endereço, remuneração, etapas e próxima ação. Cheguei à coleta, Confirmar retirada e Concluir entrega permanecem na mesma tela; Ver detalhes expande informações, telefone, observações e progresso. Após a conclusão, o painel confirma o término e permite voltar a receber ofertas. Histórico e Conta continuam acessíveis.

No Android, a rota segue vias reais até o estabelecimento nas etapas accepted/arrived; depois de collect confirmado no servidor, troca para o endereço de entrega com o GPS atual. A rota some após delivered. O app preserva a versão confirmada de cada etapa para que respostas antigas de polling não reabram etapas anteriores. A câmera enquadra o trajeto e reserva espaço para o painel; Minha localização também enquadra a rota. Abrir navegação abre Google Maps com o endereço da etapa atual e utiliza a localização do dispositivo.

O backend oferece POST /api/v1/deliveries/:id/navigation, exclusivo para entregadores autenticados, limitado a 10 solicitações por minuto. O corpo contém latitude, longitude, timestamp e version. O destino é obtido no servidor, com escopo de empresa e entregador; não admite um endereço arbitrário enviado pelo cliente. Coordenadas são validadas e exigem amostra de até 30 segundos. A resposta usa Cache-Control: no-store. Se a etapa mudar durante o cálculo, o servidor descarta a resposta. O aplicativo não persiste geometria nem recalcula a cada cinco segundos: novas etapas iniciam novo cálculo; durante o deslocamento recalcula após pelo menos 60 segundos e 100 metros.

Configure GOOGLE_MAPS_KEY no .env **da raiz**, habilitando Routes API no projeto Google Cloud, e atualize o backend:

```sh
docker compose --profile app up -d --build api
```

A chave é privada do backend, diferente de GOOGLE_MAPS_ANDROID_KEY usada ao compilar o mapa do APK. O mapa incluso no Expo Go não fornece autorização para consultar Routes API. Sem a chave, nenhuma rota fictícia é desenhada; o app oferece abrir navegação externa. Para o desenho integrado é necessário que o mapa Google carregue no aparelho. A falha reportada do Expo Go SDK 57 não é resolvida pelo novo endpoint de rotas. No iOS com Apple Maps, o painel funciona e oferece navegação externa; rotas Google não são sobrepostas ao mapa Apple. Não há navegação por voz nem instruções curva a curva nesta implementação.

Fontes: https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes e https://developers.google.com/maps/documentation/routes/policies.

Verificação desta integração: 28 testes móveis e 11 testes unitários da API passaram. Teste HTTP de navegação foi incluído, mas a execução da integração ficou bloqueada por EPERM no acesso ao PostgreSQL local. Build/atualização Docker também ficou bloqueado pelo acesso ao socket Docker nesta sessão. GPS, renderização, trajeto real com chave de produção e interação do painel precisam de verificação no aparelho.
