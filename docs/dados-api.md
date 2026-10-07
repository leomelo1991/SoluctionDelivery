# Dados e contratos

Entidades principais: Tenant, User, Session, Establishment, Courier, Delivery, DeliveryOffer, DeliveryEvent, CRMNote, AuditEvent, PricingConfig, Region, Surcharge, Quote e Idempotency. Migração versionada inclui chaves entre empresas, índice de entrega ativa única e verificações de estado e valores.

API: `/api/v1`. Documento OpenAPI gerado no pacote contracts, Swagger em `/api/docs`. Listas retornam `{items,total,page,pageSize}`; pageSize até 100. Datas ISO UTC; apresentação no fuso da operação. Identificadores UUID; código legível da entrega gerado pelo banco.

Mutações enviam Origin e X-CSRF-Token. Comandos POST /deliveries e /deliveries/:id/:action também enviam Idempotency-Key. Ações enviam version. Reutilizar chave com outro comando ou corpo retorna conflito. quoteId vincula criação ao orçamento confirmado e ao autor.

Endpoints: auth/login, auth/logout, auth/password, me; establishments e notes; couriers, approval-actions e me/availability; users, active e reset-password; deliveries, detalhes e assign/accept/decline/arrive/collect/complete; couriers/me/offers; dashboard; pricing, formula, regions, surcharges, routing e quotes; audit; health/live e health/ready.

Erros retornam `{code,message,requestId}`. 400 para validação, 401 para sessão, 403 para autorização, 404 para registro fora do escopo, 409 para conflito ou cotação inválida, 429 para limite e 503 para indisponibilidade. Não expor consultas, credenciais ou stack trace.

Usuários têm um perfil e um vínculo compatível. Vários operadores podem acessar a mesma loja; um entregador possui um usuário. Propriedade da empresa é imutável pela API. Não há endpoints de exclusão de entregas ou auditoria.

Históricos concluídos e indicadores de período filtram a data de conclusão (`updatedAt`), com índices por empresa, estabelecimento ou entregador. A ordenação das concluídas também usa essa data.

## Autenticação móvel

`POST /api/v1/auth/mobile/login`: `{tenant,email,password}`, sem Origin/cookie; somente courier. Resposta `{accessToken,expiresAt,user}`. Endpoint compartilha rate limit de login. Use `Authorization: Bearer <accessToken>` nos endpoints existentes; `/me`, `/auth/password` e `/auth/logout` são os únicos liberados antes da primeira troca de senha. Migration 003 adiciona Session.channel com default web e CHECK web/mobile.
