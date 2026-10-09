-- Keep the source identity index below PostgreSQL's identifier limit.
ALTER INDEX "ExternalOrder_tenantId_establishmentId_provider_externalReference_key" RENAME TO "ExternalOrder_source_key";
