-- ============================================================
-- RESONANCE DB WIPE + SCHEMA MIGRATION
-- Fixed: column name is githubId (camelCase), not github_id
-- ============================================================

-- Step 1: Wipe all data (children first, parents last)
DELETE FROM simulations;
DELETE FROM edges;
DELETE FROM blocks;
DELETE FROM team_members;
DELETE FROM designs;
DELETE FROM teams;
DELETE FROM sessions;
DELETE FROM users;

-- Step 2: Drop sessions table (CASCADE handles the fkey constraint)
DROP TABLE IF EXISTS sessions CASCADE;

-- Step 3: Drop the old githubId unique constraint if it exists
-- (Your schema shows no unique constraint on githubId, so this is a no-op)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_github_id_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_githubId_key;

-- Step 4: Add clerkId column
ALTER TABLE users ADD COLUMN IF NOT EXISTS "clerkId" TEXT;

-- Step 5: githubId is already nullable per your schema, but safety check
-- (no-op since it's already nullable)

-- Step 6: Enforce clerkId as required and unique
ALTER TABLE users ALTER COLUMN "clerkId" SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_clerkId_key UNIQUE ("clerkId");

-- Step 7: Verify everything is clean (should all be 0)
SELECT 
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'designs', COUNT(*) FROM designs
UNION ALL SELECT 'simulations', COUNT(*) FROM simulations
UNION ALL SELECT 'teams', COUNT(*) FROM teams
UNION ALL SELECT 'team_members', COUNT(*) FROM team_members
UNION ALL SELECT 'blocks', COUNT(*) FROM blocks
UNION ALL SELECT 'edges', COUNT(*) FROM edges;