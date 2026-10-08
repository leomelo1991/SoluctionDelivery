# Mapa da operação

Disponível em `/admin/mapa` e `/estabelecimento/mapa`, na mesma plataforma e com os mesmos cadastros do CRM.

- Admin: estabelecimentos da empresa, locais de entregas não concluídas e entregadores aprovados disponíveis/ocupados com GPS recente.
- Estabelecimento: apenas o próprio cadastro, suas entregas e o GPS dos entregadores nas suas entregas aceitas, em coleta ou em entrega. Não vê concorrentes nem entregadores disponíveis sem vínculo com suas entregas.
- Pin verde: estabelecimento com cadastro ativo e operação aberta. Cinza: fechado/inativo. Esse destaque indica operação aberta, não presença de um usuário conectado.
- Coleta e entrega usam os endereços registrados na entrega (preservando o endereço da coleta mesmo se o cadastro mudar depois). O pin do estabelecimento usa o cadastro atual. A etapa atual fica indicada no detalhe/lista.
- Posições consultadas a cada 2 segundos com a página visível; sem consultas concorrentes. Posições com mais de 30 segundos deixam de aparecer, inclusive em falhas da API.
- GPS enviado pelo app nativo e pelo painel web do entregador, aprovado e disponível/ocupado, com permissão do aparelho. Amostras novas, válidas e recentes; nunca atualizamos o horário de uma amostra antiga para simular presença.
- App nativo: pede ao SO amostras a cada 2 segundos; continua nas abas internas, pausa em segundo plano. Web: consulta GPS enquanto a página está visível. A frequência efetiva depende do sistema operacional, rede e GPS. Não há rastreamento com o app fechado/tela bloqueada nesta versão.
- Marcadores mudam de posição a cada atualização. Não há histórico de trajetos nem linha que simule uma rota pelas ruas. A navegação do app continua com o provedor já existente.

## Configuração e publicação

1. Aplicar migration `202610080002_operations_map` na API (`pnpm db:migrate`); publicar API e painel desta branch. O script de release da API continua responsável pelas migrations em produção.
2. No projeto Vercel da **API**: `GOOGLE_MAPS_KEY`, chave privada com **Geocoding API** habilitada (e Routes API, já usada pela navegação). Projeto Google com faturamento e cota disponíveis.
3. No projeto Vercel do **painel**: `VITE_GOOGLE_MAPS_KEY`, chave pública distinta, restrita à **Maps JavaScript API** e aos domínios autorizados (por exemplo `https://solution-delivery-painel.vercel.app/*`). Fazer novo build/deploy do painel após definir a variável. Não reutilizar a chave privada do servidor no frontend.
4. Desenvolvimento: copiar `apps/web/.env.example` para `apps/web/.env.local` e preencher a chave pública; a chave privada fica no `.env` da API/raiz. Para o app, manter a configuração Google Maps nativa existente e distribuir uma nova versão com envio de GPS.

Sem as chaves, a página mostra a lista e a indisponibilidade dos pins/mapa, sem inventar coordenadas. Nenhuma chave real é incluída no repositório. Os testes automatizados não dependem de cotas Google: geocodificação é simulada no teste de integração e o navegador testa a alternativa sem chave. A renderização/cartografia Google deve ser validada após configurar chaves válidas.

## API e armazenamento

- `POST /api/v1/operations-map/location`: somente entregador; vínculo derivado da sessão, coordenadas e precisão validadas, timestamp GPS original em milissegundos. Escrita atômica preserva a amostra mais recente. `{accepted:false}` indica replay ou entregador inelegível.
- `GET /api/v1/operations-map`: somente admin/estabelecimento, escopo por empresa e estabelecimento, `Cache-Control: no-store`.
- `POST /api/v1/operations-map/resolve`: resolve somente endereços autorizados da operação, até 8 por chamada. Cache compartilhado PostgreSQL e lease evitam chamadas duplicadas entre instâncias da Vercel. A tela tenta lotes a cada 10 segundos enquanto faltam coordenadas. Sem geocodificação no poll de GPS.
- Coordenadas Google expiram em 27 dias, falhas em 5 minutos; mudança de endereço gera outra chave. Resultados ambíguos não viram pins. A migração cria `MapGeocode` e `CourierPosition`.
- Apenas última posição por entregador, sem tabela de trajetos. Ficar indisponível pela API remove a posição; GPS antigo pode permanecer armazenado, mas nunca é exibido após 30 segundos. A exclusão do entregador remove a posição em cascata.
- Executar periodicamente a manutenção abaixo para excluir caches vencidos e GPS inativo (por exemplo diariamente no agendador da infraestrutura):

```sql
DELETE FROM "MapGeocode" WHERE "expiresAt" < now();
DELETE FROM "CourierPosition" WHERE "observedAt" < now() - interval '1 day';
```

O mapa limita cada grupo a 1.000 registros e exibe aviso quando ultrapassado. Para operações maiores, evoluir para consultas por área/agrupamento. O poll de 2 segundos gera aproximadamente 30 consultas por minuto por painel aberto, além do envio de cada entregador; dimensionar API, PostgreSQL, Redis e quotas Google antes de ampliar a frota.
