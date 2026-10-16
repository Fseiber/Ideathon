-- CreateTable
CREATE TABLE "LotReservation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lotId" INTEGER NOT NULL,
    "requestId" INTEGER,
    "tons" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SOLICITADA',
    "expiresAt" DATETIME NOT NULL,
    "confirmedAt" DATETIME,
    "confirmedById" INTEGER,
    "confirmationChannel" TEXT,
    "confirmationContact" TEXT,
    "confirmationReference" TEXT,
    "releasedAt" DATETIME,
    "releaseReason" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LotReservation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LotReservation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LotReservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LotReservation_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable (aditivo: columna con default, sin reconstruir Lot)
ALTER TABLE "Lot" ADD COLUMN "tonsReserved" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "LotReservation_status_expiresAt_idx" ON "LotReservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "LotReservation_requestId_idx" ON "LotReservation"("requestId");

-- CreateIndex
CREATE INDEX "LotReservation_lotId_idx" ON "LotReservation"("lotId");
