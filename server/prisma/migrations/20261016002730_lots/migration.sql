/*
  Warnings:

  - You are about to alter the column `tons` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - Added the required column `lotId` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Lot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "millId" INTEGER NOT NULL,
    "product" TEXT NOT NULL DEFAULT 'Arroz largo fino',
    "tonsTotal" INTEGER NOT NULL,
    "tonsAvailable" INTEGER NOT NULL,
    "mintTxHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lot_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "millId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "destination" TEXT NOT NULL,
    "product" TEXT NOT NULL DEFAULT 'Arroz largo fino',
    "tons" INTEGER NOT NULL,
    "lotId" INTEGER NOT NULL,
    "pricePerTonCents" INTEGER NOT NULL,
    "incoterm" TEXT NOT NULL,
    "freightCents" INTEGER NOT NULL DEFAULT 0,
    "exportDutyPct" REAL NOT NULL DEFAULT 0,
    "subtotalCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "advanceCents" INTEGER NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "exportDutyCents" INTEGER NOT NULL,
    "millNetCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COTIZADA',
    "escrowFunded" BOOLEAN NOT NULL DEFAULT false,
    "stockReserved" BOOLEAN NOT NULL DEFAULT false,
    "tokensEscrowed" BOOLEAN NOT NULL DEFAULT false,
    "advanceReleased" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("advanceCents", "balanceCents", "buyerId", "createdAt", "destination", "escrowFunded", "exportDutyCents", "exportDutyPct", "freightCents", "id", "incoterm", "millId", "millNetCents", "pricePerTonCents", "product", "status", "subtotalCents", "tons", "totalCents", "updatedAt") SELECT "advanceCents", "balanceCents", "buyerId", "createdAt", "destination", "escrowFunded", "exportDutyCents", "exportDutyPct", "freightCents", "id", "incoterm", "millId", "millNetCents", "pricePerTonCents", "product", "status", "subtotalCents", "tons", "totalCents", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
