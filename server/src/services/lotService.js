import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/errors.js';
import { explorerUrl, mintArroz } from './stellar.js';

const sharedPrisma = new PrismaClient();
export async function createLot(millId, tons, prisma = sharedPrisma, product = 'Arroz largo fino') {
  const mill = await prisma.party.findUnique({ where: { id: millId } });
  if (!mill || mill.role !== 'MOLINO') throw new AppError('NOT_FOUND', 'Molino no encontrado', 404);
  const minted = await mintArroz({ toPublicKey: mill.stellarPublicKey, tons });
  return prisma.lot.create({ data: { millId, product, tonsTotal: tons, tonsAvailable: tons, mintTxHash: minted.txHash } });
}
export function serializeLot(lot) { return { id: lot.id, product: lot.product, tonsTotal: lot.tonsTotal, tonsAvailable: lot.tonsAvailable, mintTxHash: lot.mintTxHash, explorerUrl: explorerUrl(lot.mintTxHash), createdAt: lot.createdAt }; }
