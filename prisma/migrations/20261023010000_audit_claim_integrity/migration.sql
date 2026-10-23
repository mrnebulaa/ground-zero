-- Fail rather than silently delete audit history if an existing database has orphaned rows.
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_claimId_fkey"
FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
