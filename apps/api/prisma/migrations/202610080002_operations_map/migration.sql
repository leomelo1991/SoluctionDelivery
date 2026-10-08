-- CreateTable
CREATE TABLE "CourierPosition" (
    "tenantId" UUID NOT NULL,
    "courierId" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierPosition_pkey" PRIMARY KEY ("tenantId","courierId")
);

-- CreateTable
CREATE TABLE "MapGeocode" (
    "tenantId" UUID NOT NULL,
    "addressHash" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapGeocode_pkey" PRIMARY KEY ("tenantId","addressHash")
);

-- CreateIndex
CREATE INDEX "CourierPosition_tenantId_observedAt_idx" ON "CourierPosition"("tenantId", "observedAt");

-- CreateIndex
CREATE INDEX "MapGeocode_tenantId_expiresAt_idx" ON "MapGeocode"("tenantId", "expiresAt");

-- AddForeignKey
ALTER TABLE "CourierPosition" ADD CONSTRAINT "CourierPosition_tenantId_courierId_fkey" FOREIGN KEY ("tenantId", "courierId") REFERENCES "Courier"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

