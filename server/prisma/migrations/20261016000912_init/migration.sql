-- CreateTable
CREATE TABLE "Party" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "stellarPublicKey" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "millId" INTEGER NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "destination" TEXT NOT NULL,
    "product" TEXT NOT NULL DEFAULT 'Arroz largo fino',
    "tons" REAL NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_millId_fkey" FOREIGN KEY ("millId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "txHash" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Party_stellarPublicKey_key" ON "Party"("stellarPublicKey");
