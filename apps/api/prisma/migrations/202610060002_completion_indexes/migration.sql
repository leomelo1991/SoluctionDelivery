-- Completion periods use updatedAt, independent of the original request date.
CREATE INDEX "Delivery_tenantId_establishmentId_status_updatedAt_idx" ON "Delivery"("tenantId", "establishmentId", "status", "updatedAt");
CREATE INDEX "Delivery_tenantId_courierId_status_updatedAt_idx" ON "Delivery"("tenantId", "courierId", "status", "updatedAt");
CREATE INDEX "Delivery_tenantId_status_updatedAt_idx" ON "Delivery"("tenantId", "status", "updatedAt");
