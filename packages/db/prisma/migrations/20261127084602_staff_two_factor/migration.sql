-- CreateEnum
CREATE TYPE "staff_two_factor_method" AS ENUM ('authenticator_app', 'backup_code');

-- CreateTable
CREATE TABLE "staff_two_factor" (
    "user_id" UUID NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6),
    "last_used_step" INTEGER,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_two_factor_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "staff_backup_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_two_factor_sessions" (
    "session_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "method" "staff_two_factor_method" NOT NULL,
    "verified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_two_factor_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_backup_codes_code_hash_key" ON "staff_backup_codes"("code_hash");

-- CreateIndex
CREATE INDEX "staff_backup_codes_user_id_idx" ON "staff_backup_codes"("user_id");

-- CreateIndex
CREATE INDEX "staff_two_factor_sessions_user_id_idx" ON "staff_two_factor_sessions"("user_id");

-- AddForeignKey
ALTER TABLE "staff_two_factor" ADD CONSTRAINT "staff_two_factor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_backup_codes" ADD CONSTRAINT "staff_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_two_factor_sessions" ADD CONSTRAINT "staff_two_factor_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
