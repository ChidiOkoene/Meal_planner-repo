-- CreateEnum
CREATE TYPE "recipient_relationship" AS ENUM ('self', 'parent', 'relative', 'other');

-- CreateEnum
CREATE TYPE "service_tier" AS ENUM ('full_care', 'plan_only');

-- AlterTable
-- Existing recipients were all added as parents in Lagos with delivery, so they are backfilled
-- as such; the temporary defaults are then dropped so every new row must say.
ALTER TABLE "recipients" ADD COLUMN     "country_code" CHAR(2) NOT NULL DEFAULT 'NG',
ADD COLUMN     "relationship" "recipient_relationship" NOT NULL DEFAULT 'parent',
ADD COLUMN     "service_tier" "service_tier" NOT NULL DEFAULT 'full_care',
ADD COLUMN     "user_id" UUID;
ALTER TABLE "recipients" ALTER COLUMN "country_code" DROP DEFAULT,
ALTER COLUMN "service_tier" DROP DEFAULT;

-- CreateTable
CREATE TABLE "household_timeline" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "recipient_id" UUID,
    "actor_user_id" UUID,
    "data" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "household_timeline_household_id_occurred_at_idx" ON "household_timeline"("household_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "recipients_user_id_key" ON "recipients"("user_id");

-- AddForeignKey
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_timeline" ADD CONSTRAINT "household_timeline_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

