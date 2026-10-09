# Mapas gratuitos nos painéis

Os painéis usam React Leaflet + Leaflet e tiles do OpenStreetMap. O mapa base e os pins
com coordenadas/GPS não dependem de chave Google. Não há SDK Google no bundle do painel.
O zoom por rolagem está desabilitado para permitir rolar a página no celular; há botões
para zoom e enquadramento. O GPS continua sendo atualizado a cada dois segundos enquanto
a tela estiver visível, com expiração de posições antigas.

## Vercel

1. Faça deploy da nova `main` no projeto **solution-delivery-painel**. As variáveis
   `VITE_GOOGLE_MAPS_KEY` e `VITE_GOOGLE_MAPS_API_KEY` não são mais usadas.
2. Crie uma conta em https://openrouteservice.org/ e gere uma chave no painel do serviço.
3. No projeto **solution-delivery-api**, cadastre `OPENROUTESERVICE_API_KEY` como segredo
   nos ambientes necessários (Production e, se usado, Preview). Nunca use prefixo `VITE_`.
4. Faça novo deploy da API. `ROUTING_PROVIDER` usa `openrouteservice` por padrão; não é
   necessário defini-lo. Google e Mapbox não são chamados automaticamente, mesmo que as
   chaves antigas permaneçam nas variáveis. `legacy` é somente uma opção explícita de
   compatibilidade para cotação antiga.

Sem chave ORS, o mapa base continua disponível, assim como o GPS dos entregadores.
Novos endereços ficam pendentes de localização e rotas automáticas ficam indisponíveis.
Frete regional e distância manual continuam funcionando. Os trajetos de navegação do
entregador e a cotação por distância usam ORS quando configurado. O perfil driving-car
fornece trajetos rodoviários, sem trânsito em tempo real nem regras específicas de motos.
A troca não altera o SDK nativo de renderização dos aplicativos Android/iOS.

## Escopo e uso dos serviços

O administrador vê a operação da plataforma; o lojista recebe somente seu estabelecimento,
suas entregas e entregadores atendendo essas entregas. O destino da navegação é determinado
pela API a partir da entrega autorizada, nunca de um endereço arbitrário do cliente.
Endereços não localizados ou ambíguos não recebem coordenadas inventadas.
O cache de endereços é separado por provedor: resultados anteriores do Google não são
reutilizados sobre o mapa OSM. GPS enviado pelo entregador permanece disponível.

A atribuição OpenStreetMap fica visível. Os tiles públicos são adequados para demonstração
interativa moderada, sem garantia de disponibilidade: não implementar download em massa,
prefetch ou uso offline. Para maior volume, contratar/hospedar um provedor de tiles e
substituir a URL/atribuição em `OperationsMap.tsx` conforme o contrato do provedor.
Leia https://operations.osmfoundation.org/policies/tiles/ .
O plano gratuito de ORS tem cotas: consulte https://openrouteservice.org/plans/ antes do uso.
Geocodificação usa cache e lease para evitar repetição; falhas/limites ficam explícitos,
sem fallback automático para serviços pagos ou servidores demonstrativos de rotas.
