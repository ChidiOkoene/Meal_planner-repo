-- CreateTable
CREATE TABLE "processed_jobs" (
    "key" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_jobs_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "processed_jobs_completed_at_idx" ON "processed_jobs"("completed_at");
