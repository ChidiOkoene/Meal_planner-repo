-- AlterTable
ALTER TABLE "users" ADD COLUMN     "identity_synced_at" TIMESTAMPTZ(6),
ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
