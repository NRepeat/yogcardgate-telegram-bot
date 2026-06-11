-- AlterEnum
-- SUPER_ADMIN was added to the schema earlier without a migration (prod DB was
-- altered manually). IF NOT EXISTS keeps this a no-op on databases that already
-- have the value.
ALTER TYPE "RoleEnum" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
