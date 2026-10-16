-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buyerCompanyId" INTEGER NOT NULL,
    "product" TEXT NOT NULL DEFAULT 'Arroz',
    "variety" TEXT NOT NULL,
    "tons" INTEGER NOT NULL,
    "maxBrokenPct" REAL,
    "maxMoisturePct" REAL,
    "presentation" TEXT,
    "destination" TEXT NOT NULL,
    "incoterm" TEXT NOT NULL,
    "requiredBy" DATETIME,
    "certifications" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABIERTA',
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseRequest_buyerCompanyId_fkey" FOREIGN KEY ("buyerCompanyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_buyerCompanyId_idx" ON "PurchaseRequest"("buyerCompanyId");
