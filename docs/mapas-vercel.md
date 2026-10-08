# Mapas nos painéis

A mensagem “O mapa ainda não está habilitado neste painel” indica que o frontend foi compilado sem a chave pública. Não é uma rejeição do Google: nessa situação o navegador nem inicia o Maps JavaScript API.

No projeto **solution-delivery-painel**, cadastre `VITE_GOOGLE_MAPS_KEY` em Settings → Environment Variables, selecionando Production e os ambientes Preview usados. O valor deve ser somente a chave, sem `VITE_GOOGLE_MAPS_KEY=`. O alias `VITE_GOOGLE_MAPS_API_KEY` também é aceito; a variável principal tem prioridade. Depois faça um novo deployment do frontend: o Vite incorpora a chave durante o build, e alterar a variável não modifica deployments antigos. O build na Vercel agora falha com uma orientação explícita se essa chave estiver ausente.

Habilite **Maps JavaScript API** no projeto Google Cloud dessa chave pública e restrinja-a aos domínios efetivamente usados pelo painel (por exemplo `https://solution-delivery-painel.vercel.app/*`). Previews com outro domínio também precisam de uma restrição correspondente. Uma chave somente para Routes API não habilita o mapa no navegador. O serviço Google também depende da configuração de faturamento do projeto.

No projeto **solution-delivery-api**, `GOOGLE_MAPS_KEY` é uma chave separada de servidor, usada para resolver os endereços pela **Geocoding API** e calcular rotas pela **Routes API**. Ela nunca é usada como fallback da chave pública. Sem geocodificação, o mapa base pode aparecer, mas os locais sem coordenadas continuarão pendentes. Não há coordenadas inventadas para esses endereços.

O administrador vê a operação do tenant. O lojista recebe da API somente seu estabelecimento, suas entregas em aberto e GPS recente dos entregadores atendendo suas entregas aceitas, em coleta ou em entrega. Entregadores sem atendimento vinculado à loja e dados de outras lojas não são retornados. O escopo vem da sessão autenticada, não de parâmetros enviados pelo navegador.

Verificação local: `node --test --test-isolation=none apps/web/test/*.test.mjs`, build do frontend, teste de integração `operations-map.test` e Playwright `operations-map.spec.ts`/`responsive.spec.ts`. Os testes de isolamento e layout não comprovam autorização/faturamento da conta Google nem as variáveis configuradas na Vercel.
