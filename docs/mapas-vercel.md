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
Endereços sem coordenadas podem usar a aproximação por CEP em Franca, descrita abaixo; rotas automáticas pelas ruas ficam indisponíveis.
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

## Percursos e CEPs de Franca

O painel permite escolher a entrega em **Entrega no mapa** e atualizar seu trajeto.
Com ORS configurado, a linha contínua segue a rota calculada pelo serviço. Sem chave
ou em caso de falha, a linha tracejada representa somente uma ligação entre pontos,
identificada na tela como aproximação, sem distância viária inventada. A origem é o
GPS recente do entregador autorizado; sem GPS, usa-se o local de coleta e a tela
informa que se trata de percurso previsto. A rota nunca fabrica posição do entregador.

Para endereços de Franca/SP, BrasilAPI CEP v2 pode fornecer uma coordenada aproximada
quando a geocodificação exata não está disponível. CEP sem coordenadas, fora de Franca,
incompatível com a consulta ou com valores inválidos não gera pin. Essas coordenadas
não são usadas para recalcular fretes: os valores continuam dependendo da cotação
normal ou da distância manual.

No deploy da API com `SEED_INVESTORS=true` e as permissões de seed demonstrativo já
configuradas, `seed-investors` executa uma atualização única da base `investidores`.
Consulta CEPs candidatos e exige ao menos dois pontos distintos confirmados pela
BrasilAPI. Atualiza somente lojas demonstrativas identificadas e entregas do lote
`investor-presentation-v1`; preserva senhas, valores, status e históricos. Registra a
origem BrasilAPI, os CEPs consultados com sucesso e a aproximação no evento de auditoria
`investor-cep-map-v1`. Não altera outras empresas.

Se a BrasilAPI não retornar coordenadas válidas suficientes, o deploy informa que o
mapa demonstrativo está pendente, sem alterar endereços nem gravar o marcador de
conclusão. Um novo seed/deploy pode tentar novamente. O endpoint público utilizado é
`https://brasilapi.com.br/api/cep/v2/{cep}`; o ambiente deve permitir esse domínio.
