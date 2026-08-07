-- CreateTable
CREATE TABLE "risk_profile_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "riskCapacityScore" INTEGER NOT NULL,
    "riskAttitudeScore" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_profile_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_products" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "risk_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_profile_submissions_userId_completedAt_idx" ON "risk_profile_submissions"("userId", "completedAt");

-- AddForeignKey
ALTER TABLE "risk_profile_submissions" ADD CONSTRAINT "risk_profile_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
