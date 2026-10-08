-- CreateTable
CREATE TABLE "FinanceWorkspace" (
    "tenantId" UUID NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'sandbox',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceWorkspace_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "FinancePermission" (
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "capability" TEXT NOT NULL DEFAULT 'sandbox_manage',

    CONSTRAINT "FinancePermission_pkey" PRIMARY KEY ("tenantId","userId")
);

-- CreateTable
CREATE TABLE "FinanceWallet" (
    "tenantId" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceWallet_pkey" PRIMARY KEY ("tenantId","establishmentId")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "description" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceOperation" (
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceOperation_pkey" PRIMARY KEY ("tenantId","key")
);

-- CreateTable
CREATE TABLE "FinanceReservation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "consumed" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "versionId" UUID,
    "deliveryId" UUID,
    "weekStart" TIMESTAMP(3),
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "FinanceReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTopup" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "establishmentId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "scenario" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceTopup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTask" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "topupId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceProviderEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "topupId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'fake',
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "eventId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSandboxReceipt" (
    "tenantId" UUID NOT NULL,
    "topupId" UUID NOT NULL,
    "outcome" TEXT NOT NULL,

    CONSTRAINT "FinanceSandboxReceipt_pkey" PRIMARY KEY ("tenantId","topupId")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_tenantId_id_key" ON "LedgerAccount"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_tenantId_code_key" ON "LedgerAccount"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_tenantId_id_key" ON "LedgerTransaction"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_tenantId_source_key" ON "LedgerTransaction"("tenantId", "source");

-- CreateIndex
CREATE INDEX "LedgerEntry_tenantId_accountId_idx" ON "LedgerEntry"("tenantId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_tenantId_transactionId_accountId_key" ON "LedgerEntry"("tenantId", "transactionId", "accountId");

-- CreateIndex
CREATE INDEX "FinanceReservation_tenantId_establishmentId_createdAt_idx" ON "FinanceReservation"("tenantId", "establishmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReservation_tenantId_id_key" ON "FinanceReservation"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReservation_tenantId_source_key" ON "FinanceReservation"("tenantId", "source");

-- CreateIndex
CREATE INDEX "FinanceTopup_tenantId_establishmentId_createdAt_idx" ON "FinanceTopup"("tenantId", "establishmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTopup_tenantId_id_key" ON "FinanceTopup"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTopup_tenantId_reference_key" ON "FinanceTopup"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "FinanceTask_tenantId_status_nextAttemptAt_idx" ON "FinanceTask"("tenantId", "status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTask_tenantId_topupId_key" ON "FinanceTask"("tenantId", "topupId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceProviderEvent_tenantId_provider_environment_eventId_key" ON "FinanceProviderEvent"("tenantId", "provider", "environment", "eventId");

-- AddForeignKey
ALTER TABLE "FinanceWorkspace" ADD CONSTRAINT "FinanceWorkspace_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePermission" ADD CONSTRAINT "FinancePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FinanceWorkspace"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePermission" ADD CONSTRAINT "FinancePermission_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceWallet" ADD CONSTRAINT "FinanceWallet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FinanceWorkspace"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceWallet" ADD CONSTRAINT "FinanceWallet_tenantId_establishmentId_fkey" FOREIGN KEY ("tenantId", "establishmentId") REFERENCES "Establishment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FinanceWorkspace"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FinanceWorkspace"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_transactionId_fkey" FOREIGN KEY ("tenantId", "transactionId") REFERENCES "LedgerTransaction"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_accountId_fkey" FOREIGN KEY ("tenantId", "accountId") REFERENCES "LedgerAccount"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceOperation" ADD CONSTRAINT "FinanceOperation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "FinanceWorkspace"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReservation" ADD CONSTRAINT "reservation_wallet_fkey" FOREIGN KEY ("tenantId", "establishmentId") REFERENCES "FinanceWallet"("tenantId", "establishmentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReservation" ADD CONSTRAINT "FinanceReservation_tenantId_establishmentId_fkey" FOREIGN KEY ("tenantId", "establishmentId") REFERENCES "Establishment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReservation" ADD CONSTRAINT "FinanceReservation_tenantId_versionId_fkey" FOREIGN KEY ("tenantId", "versionId") REFERENCES "ContractVersion"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReservation" ADD CONSTRAINT "FinanceReservation_tenantId_deliveryId_fkey" FOREIGN KEY ("tenantId", "deliveryId") REFERENCES "Delivery"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTopup" ADD CONSTRAINT "topup_wallet_fkey" FOREIGN KEY ("tenantId", "establishmentId") REFERENCES "FinanceWallet"("tenantId", "establishmentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTopup" ADD CONSTRAINT "FinanceTopup_tenantId_establishmentId_fkey" FOREIGN KEY ("tenantId", "establishmentId") REFERENCES "Establishment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTask" ADD CONSTRAINT "FinanceTask_tenantId_topupId_fkey" FOREIGN KEY ("tenantId", "topupId") REFERENCES "FinanceTopup"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceProviderEvent" ADD CONSTRAINT "FinanceProviderEvent_tenantId_topupId_fkey" FOREIGN KEY ("tenantId", "topupId") REFERENCES "FinanceTopup"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSandboxReceipt" ADD CONSTRAINT "FinanceSandboxReceipt_tenantId_topupId_fkey" FOREIGN KEY ("tenantId", "topupId") REFERENCES "FinanceTopup"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Esta primeira versão nunca representa dinheiro real, mesmo em tenant de produção.
ALTER TABLE "FinanceWorkspace" ADD CONSTRAINT "FinanceWorkspace_sandbox" CHECK (mode = 'sandbox');
ALTER TABLE "FinancePermission" ADD CONSTRAINT "FinancePermission_capability" CHECK (capability = 'sandbox_manage');
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_valid" CHECK (currency = 'BRL' AND kind IN ('cash', 'available', 'reserved', 'revenue', 'expense', 'payable'));
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_status" CHECK (status IN ('draft', 'posted'));
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_amount" CHECK (amount <> 0 AND amount BETWEEN -999999999999 AND 999999999999);
ALTER TABLE "FinanceReservation" ADD CONSTRAINT "FinanceReservation_valid" CHECK (
  amount BETWEEN 1 AND 999999999999 AND consumed BETWEEN 0 AND amount AND status IN ('reserved', 'closed')
  AND ((status = 'reserved' AND consumed = 0 AND "closedAt" IS NULL) OR (status = 'closed' AND "closedAt" IS NOT NULL))
  AND ((kind = 'week' AND "versionId" IS NOT NULL AND "weekStart" IS NOT NULL AND "deliveryId" IS NULL)
    OR (kind = 'delivery' AND "deliveryId" IS NOT NULL AND "weekStart" IS NULL))
);
ALTER TABLE "FinanceTopup" ADD CONSTRAINT "FinanceTopup_valid" CHECK (amount BETWEEN 1 AND 999999999999 AND status IN ('pending','unknown','confirmed','rejected') AND scenario IN ('approve','decline','timeout_after_accept'));
ALTER TABLE "FinanceTask" ADD CONSTRAINT "FinanceTask_valid" CHECK (status IN ('pending','processing','done') AND attempts >= 0 AND ((status = 'processing' AND "leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL) OR (status <> 'processing' AND "leaseToken" IS NULL AND "leaseUntil" IS NULL)));
ALTER TABLE "FinanceProviderEvent" ADD CONSTRAINT "FinanceProviderEvent_sandbox" CHECK (provider = 'fake' AND environment = 'sandbox' AND outcome IN ('confirmed','rejected'));

CREATE FUNCTION finance_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state text;
BEGIN
  -- Limpeza integral de workspace SANDBOX é possível por manutenção direta, nunca pela API.
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "FinanceWorkspace" WHERE "tenantId" = OLD."tenantId") THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME = 'LedgerAccount' THEN RAISE EXCEPTION 'ledger account immutable' USING ERRCODE = '23514'; END IF;
  IF TG_TABLE_NAME = 'LedgerTransaction' THEN
    IF OLD.status = 'posted' THEN RAISE EXCEPTION 'posted transaction immutable' USING ERRCODE = '23514'; END IF;
  ELSE
    SELECT status INTO state FROM "LedgerTransaction" WHERE "tenantId" = COALESCE(NEW."tenantId", OLD."tenantId") AND id = COALESCE(NEW."transactionId", OLD."transactionId");
    IF state IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'posted entries immutable' USING ERRCODE = '23514'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER ledger_account_immutable BEFORE UPDATE OR DELETE ON "LedgerAccount" FOR EACH ROW EXECUTE FUNCTION finance_immutable();
CREATE TRIGGER ledger_transaction_immutable BEFORE UPDATE OR DELETE ON "LedgerTransaction" FOR EACH ROW EXECUTE FUNCTION finance_immutable();
CREATE TRIGGER ledger_entry_immutable BEFORE INSERT OR UPDATE OR DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION finance_immutable();

CREATE FUNCTION finance_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tid uuid; xid uuid; state text; total numeric; n bigint; acc record; net numeric;
BEGIN
  tid := COALESCE(NEW."tenantId", OLD."tenantId");
  IF TG_TABLE_NAME = 'LedgerTransaction' THEN xid := COALESCE(NEW.id, OLD.id); ELSE xid := COALESCE(NEW."transactionId", OLD."transactionId"); END IF;
  SELECT status INTO state FROM "LedgerTransaction" WHERE "tenantId" = tid AND id = xid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  PERFORM 1 FROM "FinanceWorkspace" WHERE "tenantId"=tid FOR UPDATE;
  SELECT count(*), coalesce(sum(amount),0) INTO n,total FROM "LedgerEntry" WHERE "tenantId" = tid AND "transactionId" = xid;
  IF state <> 'posted' OR n < 2 OR total <> 0 THEN RAISE EXCEPTION 'ledger must commit posted and balanced' USING ERRCODE = '23514'; END IF;
  FOR acc IN SELECT DISTINCT a.id, a.kind FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a.id=e."accountId" AND a."tenantId"=e."tenantId" WHERE e."tenantId"=tid AND e."transactionId"=xid AND a.kind IN ('available','reserved') LOOP
    SELECT coalesce(sum(e.amount),0) INTO net FROM "LedgerEntry" e JOIN "LedgerTransaction" t ON t.id=e."transactionId" AND t."tenantId"=e."tenantId" WHERE e."tenantId"=tid AND e."accountId"=acc.id AND t.status='posted';
    IF net > 0 THEN RAISE EXCEPTION 'prepaid account cannot be overdrawn' USING ERRCODE = '23514'; END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ledger_transaction_balance AFTER INSERT OR UPDATE ON "LedgerTransaction" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_balanced();
CREATE CONSTRAINT TRIGGER ledger_entry_balance AFTER INSERT OR UPDATE OR DELETE ON "LedgerEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_balanced();

ALTER TABLE "FinanceSandboxReceipt" ADD CONSTRAINT "FinanceSandboxReceipt_outcome" CHECK (outcome IN ('confirmed','rejected'));
