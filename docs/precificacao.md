# Precificação e rotas

O operador escolhe distance ou region. Distância usa fórmula da empresa: `max(mínimo, base + max(0, metros - metros incluídos) / 1000 × preço por km)`. Região usa preço fixo do destino explicitamente selecionado, com cidade compatível. Seleção de região não restringe elegibilidade do entregador.

Cobrança e remuneração possuem parâmetros independentes. Acréscimos ativos no momento da cotação: início <= agora e fim ausente ou futuro. Cada condição define valores fixos e percentuais para cada lado. Resultado: `base × (1 + soma de percentuais) + soma de fixos`. Percentuais em pontos-base (100 = 1%). Arredondamento HALF_UP para centavos, sem ponto flutuante na aritmética monetária. Não aplicar tarifas de exemplo a empresas reais.

Cotação dura 5 minutos e guarda snapshot financeiro, método, versões e origem. Criação verifica autor, corpo, endereço de coleta, tarifas e vigência. Consumo e criação ocorrem na mesma transação. Qualquer mudança relevante exige recotação. Alteração de configurações não muda entrega antiga.

Mapbox Geocoding v6 + Directions; Google Geocoding + Routes computeRoutes. Uma operação usa um provedor completo; não mistura coordenadas geradas por provedores. Mapbox principal, Google alternativa; empresa pode inverter ordem e desabilitar alternativa. Apenas provedores com credenciais no servidor ficam operacionais.

Requisições externas têm timeout de 5s. Falhas técnicas permitem alternativa; endereço inexistente ou ambíguo exige correção explícita ou distância manual justificada. Sem provedor, tarifa regional funciona; distância manual é auditada e identificada. Distância é rodoviária entre coleta e destino, sem posição do entregador.

Não armazenar respostas brutas, coordenadas ou métricas externas no histórico; exibir distância/duração durante a cotação com atribuição. Histórico preserva preço, regras e provedor, e somente distância manual quando informada pelo operador. Regras de uso e retenção devem acompanhar documentação oficial: https://developers.google.com/maps/documentation/routes/policies e https://docs.mapbox.com/api/search/geocoding/.
