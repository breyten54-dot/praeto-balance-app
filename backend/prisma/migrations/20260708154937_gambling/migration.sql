-- CreateTable
CREATE TABLE "gambling_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyLimitCents" INTEGER NOT NULL DEFAULT 50000,
    "dailyAlertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyAlertThresholdCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gambling_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooling_off_periods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cooling_off_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gambling_settings_userId_key" ON "gambling_settings"("userId");

-- CreateIndex
CREATE INDEX "cooling_off_periods_userId_endsAt_idx" ON "cooling_off_periods"("userId", "endsAt");

-- AddForeignKey
ALTER TABLE "gambling_settings" ADD CONSTRAINT "gambling_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooling_off_periods" ADD CONSTRAINT "cooling_off_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
