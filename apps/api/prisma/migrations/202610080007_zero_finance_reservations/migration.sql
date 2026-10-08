-- Preserva a participação financeira de entregas sem tarifa, sem postar partidas de zero.
ALTER TABLE "FinanceReservation" DROP CONSTRAINT "FinanceReservation_valid";
ALTER TABLE "FinanceReservation" ADD CONSTRAINT "FinanceReservation_valid" CHECK (
  amount BETWEEN 0 AND 999999999999 AND consumed BETWEEN 0 AND amount AND status IN ('reserved', 'closed')
  AND ((status = 'reserved' AND consumed = 0 AND "closedAt" IS NULL) OR (status = 'closed' AND "closedAt" IS NOT NULL))
  AND ((kind = 'week' AND "versionId" IS NOT NULL AND "weekStart" IS NOT NULL AND "deliveryId" IS NULL)
    OR (kind = 'delivery' AND "deliveryId" IS NOT NULL AND "weekStart" IS NULL))
);
