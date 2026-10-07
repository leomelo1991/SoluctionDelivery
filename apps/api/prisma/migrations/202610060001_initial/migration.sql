-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'establishment', 'courier');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('waiting', 'assigned', 'accepted', 'arrived', 'collected', 'delivered');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "routingPrimary" TEXT NOT NULL DEFAULT 'mapbox',
    "routingFallback" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "establishmentId" UUID,
    "courierId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfToken" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Establishment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "acquisitionChannel" TEXT NOT NULL DEFAULT 'direct',
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'lead',
    "operationOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Establishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courier" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vehicle" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "availabilityStatus" TEXT NOT NULL DEFAULT 'offline',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" SERIAL NOT NULL,
    "establishmentId" UUID NOT NULL,
    "courierId" UUID,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'waiting',
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "pickupAddress" JSONB NOT NULL,
    "destinationAddress" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "pickupReady" BOOLEAN NOT NULL DEFAULT false,
    "manualDistanceM" INTEGER,
    "distanceSource" TEXT,
    "feeCents" INTEGER NOT NULL,
    "courierPayoutCents" INTEGER NOT NULL,
    "pricingSnapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryOffer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "courierId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "origin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "DeliveryOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "previousStatus" "DeliveryStatus",
    "newStatus" "DeliveryStatus" NOT NULL,
    "actorUserId" UUID NOT NULL,
    "origin" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CRMNote" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CRMNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorUserId" UUID,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingConfig" (
    "tenantId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fee" JSONB NOT NULL,
    "payout" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "coverage" TEXT NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "payoutCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Surcharge" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "feeFixedCents" INTEGER NOT NULL DEFAULT 0,
    "feePercentBps" INTEGER NOT NULL DEFAULT 0,
    "payoutFixedCents" INTEGER NOT NULL DEFAULT 0,
    "payoutPercentBps" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Surcharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "inputHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "payoutCents" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idempotency" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_id_key" ON "User"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Establishment_tenantId_lifecycleStatus_idx" ON "Establishment"("tenantId", "lifecycleStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Establishment_tenantId_id_key" ON "Establishment"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Courier_tenantId_approvalStatus_availabilityStatus_idx" ON "Courier"("tenantId", "approvalStatus", "availabilityStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Courier_tenantId_id_key" ON "Courier"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Delivery_tenantId_establishmentId_status_createdAt_idx" ON "Delivery"("tenantId", "establishmentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Delivery_tenantId_courierId_status_createdAt_idx" ON "Delivery"("tenantId", "courierId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Delivery_tenantId_status_createdAt_idx" ON "Delivery"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_tenantId_id_key" ON "Delivery"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_tenantId_code_key" ON "Delivery"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryOffer_tenantId_deliveryId_courierId_key" ON "DeliveryOffer"("tenantId", "deliveryId", "courierId");

-- CreateIndex
CREATE INDEX "DeliveryEvent_tenantId_deliveryId_createdAt_idx" ON "DeliveryEvent"("tenantId", "deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "CRMNote_tenantId_establishmentId_createdAt_idx" ON "CRMNote"("tenantId", "establishmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Region_tenantId_id_key" ON "Region"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Region_tenantId_name_key" ON "Region"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Surcharge_tenantId_active_startsAt_idx" ON "Surcharge"("tenantId", "active", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Surcharge_tenantId_id_key" ON "Surcharge"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Quote_tenantId_expiresAt_idx" ON "Quote"("tenantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Idempotency_tenantId_userId_key_key" ON "Idempotency"("tenantId", "userId", "key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_establishmentId_fkey" FOREIGN KEY ("tenantId", "establishmentId") REFERENCES "Establishment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_courierId_fkey" FOREIGN KEY ("tenantId", "courierId") REFERENCES "Courier"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_tenantId_establishmentId_fkey" FOREIGN KEY ("tenantId", "establishmentId") REFERENCES "Establishment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_tenantId_courierId_fkey" FOREIGN KEY ("tenantId", "courierId") REFERENCES "Courier"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_tenantId_deliveryId_fkey" FOREIGN KEY ("tenantId", "deliveryId") REFERENCES "Delivery"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_tenantId_courierId_fkey" FOREIGN KEY ("tenantId", "courierId") REFERENCES "Courier"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_tenantId_deliveryId_fkey" FOREIGN KEY ("tenantId", "deliveryId") REFERENCES "Delivery"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CRMNote" ADD CONSTRAINT "CRMNote_tenantId_establishmentId_fkey" FOREIGN KEY ("tenantId", "establishmentId") REFERENCES "Establishment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business invariants enforced independently of application code.
ALTER TABLE "User" ADD CONSTRAINT "User_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "CRMNote" ADD CONSTRAINT "CRMNote_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "PricingConfig" ADD CONSTRAINT "PricingConfig_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "Region" ADD CONSTRAINT "Region_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "Surcharge" ADD CONSTRAINT "Surcharge_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
ALTER TABLE "Idempotency" ADD CONSTRAINT "Idempotency_tenant_fk" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "Delivery_one_active_per_courier" ON "Delivery" ("tenantId", "courierId") WHERE "courierId" IS NOT NULL AND "status" IN ('assigned','accepted','arrived','collected');
CREATE UNIQUE INDEX "User_one_per_courier" ON "User" ("tenantId", "courierId") WHERE "courierId" IS NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_role_link" CHECK ((role='admin' AND "establishmentId" IS NULL AND "courierId" IS NULL) OR (role='establishment' AND "establishmentId" IS NOT NULL AND "courierId" IS NULL) OR (role='courier' AND "courierId" IS NOT NULL AND "establishmentId" IS NULL));
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_status_link" CHECK ((status='waiting' AND "courierId" IS NULL) OR (status<>'waiting' AND "courierId" IS NOT NULL));
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_money_positive" CHECK ("feeCents">=0 AND "courierPayoutCents">=0 AND ("manualDistanceM" IS NULL OR "manualDistanceM">=0));
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_approval" CHECK ("approvalStatus" IN ('pending','approved','paused'));
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_availability" CHECK ("availabilityStatus" IN ('offline','available','busy'));
ALTER TABLE "Courier" ADD CONSTRAINT "Courier_approved_availability" CHECK ("approvalStatus"='approved' OR "availabilityStatus"='offline');
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_lifecycle" CHECK ("lifecycleStatus" IN ('lead','onboarding','active','paused'));
ALTER TABLE "Establishment" ADD CONSTRAINT "Establishment_open" CHECK ("lifecycleStatus"='active' OR NOT "operationOpen");
ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_status" CHECK (status IN ('pending','accepted','declined','withdrawn') AND origin IN ('open','manual'));
ALTER TABLE "Region" ADD CONSTRAINT "Region_prices" CHECK ("feeCents">=0 AND "payoutCents">=0);
ALTER TABLE "Surcharge" ADD CONSTRAINT "Surcharge_values" CHECK ("feeFixedCents">=0 AND "payoutFixedCents">=0 AND "feePercentBps">=0 AND "payoutPercentBps">=0 AND ("endsAt" IS NULL OR "endsAt">"startsAt"));
