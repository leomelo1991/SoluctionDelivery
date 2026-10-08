-- Uma simulação de repasse preserva o ganho, valor e destino originais.
CREATE FUNCTION finance_payout_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE earned bigint;
BEGIN
 IF TG_OP='DELETE' THEN
   IF NOT EXISTS (SELECT 1 FROM "FinanceWorkspace" WHERE "tenantId"=OLD."tenantId") THEN RETURN OLD; END IF;
   RAISE EXCEPTION 'payout history cannot be deleted' USING ERRCODE='23514';
 END IF;
 IF TG_OP='INSERT' THEN
   SELECT amount INTO earned FROM "FinanceEarning" WHERE "tenantId"=NEW."tenantId" AND id=NEW."earningId";
   IF earned IS DISTINCT FROM NEW.amount OR NEW.status<>'pending' THEN RAISE EXCEPTION 'invalid payout origin' USING ERRCODE='23514'; END IF;
 ELSE
   IF (to_jsonb(OLD)-ARRAY['status','updatedAt']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['status','updatedAt']) THEN RAISE EXCEPTION 'payout identity immutable' USING ERRCODE='23514'; END IF;
   IF NEW.status<>OLD.status AND NOT ((OLD.status='pending' AND NEW.status IN ('unknown','paid','rejected')) OR (OLD.status='unknown' AND NEW.status IN ('paid','rejected')) OR (OLD.status='paid' AND NEW.status='returned')) THEN RAISE EXCEPTION 'invalid payout transition' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payout_integrity BEFORE INSERT OR UPDATE OR DELETE ON "FinancePayout" FOR EACH ROW EXECUTE FUNCTION finance_payout_integrity();

CREATE FUNCTION finance_attendance_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "CourierAllocation" a JOIN "ScheduledShift" s ON s.id=a."shiftId" AND s."tenantId"=a."tenantId" JOIN "FinanceSettlement" f ON f."tenantId"=s."tenantId" AND f."versionId"=s."versionId" AND s."startsAt">=f."weekStart" AND s."startsAt"<f."weekStart"+interval '7 days' WHERE a.id=OLD."allocationId" AND a."tenantId"=OLD."tenantId") THEN RAISE EXCEPTION 'settled attendance immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER settled_attendance_immutable BEFORE UPDATE OR DELETE ON "AttendanceEvent" FOR EACH ROW EXECUTE FUNCTION finance_attendance_history();
