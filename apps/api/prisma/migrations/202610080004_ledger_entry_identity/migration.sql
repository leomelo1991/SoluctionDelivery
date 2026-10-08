-- Também impede mover uma partida postada para outra transação ainda em rascunho.
CREATE OR REPLACE FUNCTION finance_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state text;
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "FinanceWorkspace" WHERE "tenantId" = OLD."tenantId") THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME = 'LedgerAccount' OR (TG_TABLE_NAME = 'LedgerEntry' AND TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'ledger identity immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'LedgerTransaction' THEN
    IF OLD.status = 'posted' THEN RAISE EXCEPTION 'posted transaction immutable' USING ERRCODE = '23514'; END IF;
  ELSE
    SELECT status INTO state FROM "LedgerTransaction" WHERE "tenantId" = COALESCE(NEW."tenantId", OLD."tenantId") AND id = COALESCE(NEW."transactionId", OLD."transactionId");
    IF state IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'posted entries immutable' USING ERRCODE = '23514'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
