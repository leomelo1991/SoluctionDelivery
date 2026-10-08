-- CreateTable
CREATE TABLE "FinanceSettlement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "total" BIGINT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEarning" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "settlementId" UUID NOT NULL,
    "courierId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePayout" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "earningId" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scenario" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceSettlement_tenantId_establishmentId_createdAt_idx" ON "FinanceSettlement"("tenantId", "establishmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSettlement_tenantId_id_key" ON "FinanceSettlement"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSettlement_tenantId_versionId_weekStart_key" ON "FinanceSettlement"("tenantId", "versionId", "weekStart");

-- CreateIndex
CREATE INDEX "FinanceEarning_tenantId_courierId_createdAt_idx" ON "FinanceEarning"("tenantId", "courierId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEarning_tenantId_id_key" ON "FinanceEarning"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEarning_tenantId_source_key" ON "FinanceEarning"("tenantId", "source");

-- CreateIndex
CREATE INDEX "FinancePayout_tenantId_status_createdAt_idx" ON "FinancePayout"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayout_tenantId_id_key" ON "FinancePayout"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "FinanceSettlement" ADD CONSTRAINT "FinanceSettlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FinanceWorkspace"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSettlement" ADD CONSTRAINT "FinanceSettlement_tenantId_versionId_fkey" FOREIGN KEY ("tenantId", "versionId") REFERENCES "ContractVersion"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEarning" ADD CONSTRAINT "FinanceEarning_tenantId_settlementId_fkey" FOREIGN KEY ("tenantId", "settlementId") REFERENCES "FinanceSettlement"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEarning" ADD CONSTRAINT "FinanceEarning_tenantId_courierId_fkey" FOREIGN KEY ("tenantId", "courierId") REFERENCES "Courier"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayout" ADD CONSTRAINT "FinancePayout_tenantId_earningId_fkey" FOREIGN KEY ("tenantId", "earningId") REFERENCES "FinanceEarning"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "FinanceSettlement" ADD CONSTRAINT settlement_total CHECK (total BETWEEN 0 AND 999999999999);
ALTER TABLE "FinanceSettlement" ADD CONSTRAINT settlement_store FOREIGN KEY ("tenantId", "establishmentId") REFERENCES "Establishment" ("tenantId", id);
ALTER TABLE "FinanceEarning" ADD CONSTRAINT earning_amount CHECK (amount BETWEEN 1 AND 999999999999);
ALTER TABLE "FinancePayout" ADD CONSTRAINT payout_valid CHECK (amount BETWEEN 1 AND 999999999999 AND status IN ('pending','unknown','paid','rejected','returned') AND scenario IN ('approve','decline','timeout_after_accept') AND destination='sandbox');
CREATE UNIQUE INDEX payout_active_earning ON "FinancePayout" ("tenantId", "earningId") WHERE status IN ('pending','unknown','paid');
CREATE FUNCTION finance_document_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND NOT EXISTS (SELECT 1 FROM "FinanceWorkspace" WHERE "tenantId"=OLD."tenantId") THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'closed financial document is immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER settlement_immutable BEFORE UPDATE OR DELETE ON "FinanceSettlement" FOR EACH ROW EXECUTE FUNCTION finance_document_immutable();
CREATE TRIGGER earning_immutable BEFORE UPDATE OR DELETE ON "FinanceEarning" FOR EACH ROW EXECUTE FUNCTION finance_document_immutable();
-- Presença fechada exige ajuste financeiro futuro; nunca reescrever a base do demonstrativo.
CREATE FUNCTION finance_attendance_closed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "CourierAllocation" a JOIN "ScheduledShift" s ON s.id=a."shiftId" AND s."tenantId"=a."tenantId" JOIN "FinanceSettlement" f ON f."tenantId"=s."tenantId" AND f."versionId"=s."versionId" AND s."startsAt">=f."weekStart" AND s."startsAt"<f."weekStart"+interval '7 days' WHERE a.id=NEW."allocationId" AND a."tenantId"=NEW."tenantId") THEN RAISE EXCEPTION 'attendance already settled' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER attendance_not_settled BEFORE INSERT ON "AttendanceEvent" FOR EACH ROW EXECUTE FUNCTION finance_attendance_closed();
