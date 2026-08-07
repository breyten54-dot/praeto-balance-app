-- AlterTable
ALTER TABLE "learn_modules" ADD COLUMN "bodyMarkdown" TEXT NOT NULL,
ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "videoStatus" TEXT NOT NULL DEFAULT 'not_produced';
