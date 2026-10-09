CREATE TABLE "ExternalOrder" (
 "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "establishmentId" UUID NOT NULL,
 "provider" TEXT NOT NULL, "externalReference" TEXT NOT NULL,
 "mode" TEXT NOT NULL DEFAULT 'demo' CHECK ("mode" = 'demo'),
 "recipientName" TEXT NOT NULL, "recipientPhone" TEXT NOT NULL,
 "destinationAddress" JSONB NOT NULL, "notes" TEXT NOT NULL,
 "deliveryId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ExternalOrder_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ExternalOrder_establishment_fkey" FOREIGN KEY ("tenantId", "establishmentId") REFERENCES "Establishment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ExternalOrder_delivery_fkey" FOREIGN KEY ("tenantId", "deliveryId") REFERENCES "Delivery"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExternalOrder_deliveryId_key" ON "ExternalOrder"("deliveryId");
CREATE UNIQUE INDEX "ExternalOrder_tenantId_establishmentId_provider_externalReference_key" ON "ExternalOrder"("tenantId", "establishmentId", "provider", "externalReference");
CREATE INDEX "ExternalOrder_tenantId_establishmentId_createdAt_idx" ON "ExternalOrder"("tenantId", "establishmentId", "createdAt");
