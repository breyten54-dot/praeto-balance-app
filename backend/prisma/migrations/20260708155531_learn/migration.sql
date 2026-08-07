-- CreateTable
CREATE TABLE "learn_modules" (
    "id" TEXT NOT NULL,
    "pillar" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,

    CONSTRAINT "learn_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learn_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learn_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learn_modules_pillar_orderIndex_key" ON "learn_modules"("pillar", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "learn_completions_userId_moduleId_key" ON "learn_completions"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "points_ledger_userId_idx" ON "points_ledger"("userId");

-- AddForeignKey
ALTER TABLE "learn_completions" ADD CONSTRAINT "learn_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learn_completions" ADD CONSTRAINT "learn_completions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "learn_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
