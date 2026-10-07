# Produto e requisitos

Solution Delivery é um SaaS B2B para empresas de logística. Cada empresa possui seu administrador, estabelecimentos e rede de entregadores. Não existe vitrine de comida para consumidores.

## Requisitos

| ID  | Capacidade                                   | Implementação                   | Validação                         |
| --- | -------------------------------------------- | ------------------------------- | --------------------------------- |
| R01 | Empresas isoladas e autenticação             | Segurança, Tenant, Session      | Integração de isolamento e sessão |
| R02 | Criar e acompanhar entrega na loja e CRM     | Entregas, painel operacional    | Jornada integrada                 |
| R03 | Aceitar, recusar, chegar, retirar e concluir | Entregas e app mobile           | Domínio, concorrência e jornada   |
| R04 | Cadastros, aprovação e CRM persistentes      | Directory, notas e usuários     | Integração e UI                   |
| R05 | Cotar por distância ou tarifa regional       | Pricing, configurações          | Testes monetários e cotação       |
| R06 | Acréscimos manuais cumulativos               | Surcharge, histórico financeiro | Testes monetários                 |
| R07 | Mapbox e Google com alternativa manual       | RoutingProvider                 | Testes com provedores controlados |
| R08 | Identidade e componentes reutilizáveis       | UI compartilhada e tokens       | Playwright e revisão visual       |
| R09 | Execução reproduzível e operação             | Compose, migrações e runbook    | Build e health checks             |

## Decisões confirmadas

SaaS multiempresa; provisionamento assistido; Docker portável; todos os entregadores da empresa elegíveis; escolha de preço pelo operador; Mapbox principal com Google como alternativa; distância manual auditada; acréscimos manuais cumulativos com cobrança e remuneração separadas.

Primeira versão: três interfaces completas da referência. Fora: assinatura SaaS, pagamentos/repasses, rastreamento GPS em segundo plano, cancelamento, expiração de ofertas, reatribuição de entregas ativas, notificações push e integrações de marketplaces. A vigência da cotação não é expiração de oferta.

Sucesso: a mesma entrega persiste no banco e percorre todo o fluxo nas três sessões, mantendo permissões, preços contratados, eventos únicos e disponibilidade consistente.
