-- Canvas groups: server-backed metadata (Phase 1).
-- Groups are presentation-only; blocks/edges stay the simulation contract.
-- IF NOT EXISTS: safe to re-run against a DB where the column already landed.
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "canvasMeta" JSONB;
