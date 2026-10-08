-- CreateTable
CREATE TABLE "MerchantContract" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVersion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "terms" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proposedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" UUID,
    "acceptanceEvidence" TEXT,

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledShift" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "templateIndex" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierAllocation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "courierId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "allocationId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "attendedMinutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MerchantContract_tenantId_establishmentId_idx" ON "MerchantContract"("tenantId", "establishmentId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantContract_tenantId_id_key" ON "MerchantContract"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersion_tenantId_id_key" ON "ContractVersion"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersion_tenantId_contractId_number_key" ON "ContractVersion"("tenantId", "contractId", "number");

-- CreateIndex
CREATE INDEX "ScheduledShift_tenantId_startsAt_idx" ON "ScheduledShift"("tenantId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledShift_tenantId_id_key" ON "ScheduledShift"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledShift_tenantId_versionId_templateIndex_startsAt_key" ON "ScheduledShift"("tenantId", "versionId", "templateIndex", "startsAt");

-- CreateIndex
CREATE INDEX "CourierAllocation_tenantId_courierId_startsAt_idx" ON "CourierAllocation"("tenantId", "courierId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourierAllocation_tenantId_id_key" ON "CourierAllocation"("tenantId", "id");

-- CreateIndex
CREATE INDEX "AttendanceEvent_tenantId_allocationId_createdAt_idx" ON "AttendanceEvent"("tenantId", "allocationId", "createdAt");

-- AddForeignKey
ALTER TABLE "MerchantContract" ADD CONSTRAINT "MerchantContract_tenantId_establishmentId_fkey" FOREIGN KEY ("tenantId", "establishmentId") REFERENCES "Establishment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_tenantId_contractId_fkey" FOREIGN KEY ("tenantId", "contractId") REFERENCES "MerchantContract"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_tenantId_versionId_fkey" FOREIGN KEY ("tenantId", "versionId") REFERENCES "ContractVersion"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierAllocation" ADD CONSTRAINT "CourierAllocation_tenantId_shiftId_fkey" FOREIGN KEY ("tenantId", "shiftId") REFERENCES "ScheduledShift"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierAllocation" ADD CONSTRAINT "CourierAllocation_tenantId_courierId_fkey" FOREIGN KEY ("tenantId", "courierId") REFERENCES "Courier"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_tenantId_allocationId_fkey" FOREIGN KEY ("tenantId", "allocationId") REFERENCES "CourierAllocation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_valid" CHECK ("effectiveTo" > "effectiveFrom" AND status IN ('draft', 'proposed', 'accepted') AND number > 0 AND revision > 0);
ALTER TABLE "ScheduledShift" ADD CONSTRAINT "ScheduledShift_valid" CHECK ("endsAt" > "startsAt" AND capacity BETWEEN 1 AND 50 AND "templateIndex" >= 0 AND status IN ('scheduled', 'cancelled'));
ALTER TABLE "CourierAllocation" ADD CONSTRAINT "CourierAllocation_valid" CHECK ("endsAt" > "startsAt" AND position BETWEEN 1 AND 50);
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_minutes" CHECK ("attendedMinutes" >= 0);
ALTER TABLE "CourierAllocation" ADD CONSTRAINT "CourierAllocation_exclusive_courier" EXCLUDE USING gist ("tenantId" WITH =, "courierId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&) WHERE ("cancelledAt" IS NULL);
ALTER TABLE "CourierAllocation" ADD CONSTRAINT "CourierAllocation_exclusive_position" EXCLUDE USING gist ("tenantId" WITH =, "shiftId" WITH =, position WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&) WHERE ("cancelledAt" IS NULL);
CREATE FUNCTION protect_contract_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status <> 'draft' THEN
   IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Published contract versions cannot be deleted'; END IF;
   IF OLD.status <> 'proposed' OR NEW.status <> 'accepted'
     OR (to_jsonb(OLD) - ARRAY['status','revision','acceptedAt','acceptedBy','acceptanceEvidence']) IS DISTINCT FROM (to_jsonb(NEW) - ARRAY['status','revision','acceptedAt','acceptedBy','acceptanceEvidence']) THEN
     RAISE EXCEPTION 'Published contract terms are immutable';
   END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "ContractVersion_immutable" BEFORE UPDATE ON "ContractVersion" FOR EACH ROW EXECUTE FUNCTION protect_contract_version();
