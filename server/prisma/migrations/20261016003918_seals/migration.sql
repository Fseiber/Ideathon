-- AlterTable
ALTER TABLE "Order" ADD COLUMN "sealHash" TEXT;
ALTER TABLE "Order" ADD COLUMN "sealSequence" INTEGER;
ALTER TABLE "Order" ADD COLUMN "sealTopicId" TEXT;
ALTER TABLE "Order" ADD COLUMN "sealedAt" DATETIME;
