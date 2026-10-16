import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/errors.js';
import { fetchMirrorMessage, getHederaMode, submitSeal } from './hederaService.js';

const sharedPrisma = new PrismaClient();
const include = { events: { orderBy: { createdAt: 'asc' } } };
export function canonicalOrder(order, settleEvent) {
  return JSON.stringify({ advanceCents: order.advanceCents, balanceCents: order.balanceCents, completedAt: new Date(settleEvent.createdAt || settleEvent.completedAt).toISOString(), destination: order.destination, incoterm: order.incoterm, lotId: order.lotId, orderId: order.id || order.orderId, settleTxHash: settleEvent.txHash || settleEvent.settleTxHash, tons: order.tons, totalCents: order.totalCents });
}
export function orderHash(canonical) { return createHash('sha256').update(canonical).digest('hex'); }
async function loadOrder(prisma, orderId) { return prisma.order.findUnique({ where: { id: orderId }, include }); }
async function waitForSeal(prisma, orderId) { for (let attempt = 0; attempt < 20; attempt += 1) { const order = await loadOrder(prisma, orderId); if (order?.sealHash && order.sealSequence !== null) return order; await new Promise(resolve => setTimeout(resolve, 5)); } return loadOrder(prisma, orderId); }
function settleEvent(order) { return order.events.find(event => event.type === 'SETTLE_DVP'); }
export async function sealOrder(orderId, prisma = sharedPrisma) {
  let order = await loadOrder(prisma, orderId);
  if (!order) throw new AppError('NOT_FOUND', 'Orden no encontrada', 404);
  if (order.status !== 'COMPLETADA') throw new AppError('INVALID_STATE', 'La orden no está completada', 409);
  if (order.sealHash && order.sealSequence !== null) return order;
  const settled = settleEvent(order);
  if (!settled) throw new AppError('INVALID_STATE', 'La orden no tiene liquidación', 409);
  const hash = orderHash(canonicalOrder(order, settled));
  const claim = await prisma.order.updateMany({ where: { id: orderId, sealHash: null }, data: { sealHash: hash } });
  if (claim.count === 0) return waitForSeal(prisma, orderId);
  try {
    const sealed = await submitSeal({ message: JSON.stringify({ v: 1, type: 'ORDER_COMPLETED', orderId, hash, stellarTx: settled.txHash }) });
    await prisma.order.update({ where: { id: orderId }, data: { sealTopicId: sealed.topicId, sealSequence: sealed.sequenceNumber, sealedAt: new Date() } });
    await prisma.orderEvent.create({ data: { orderId, type: 'SEAL_HEDERA', txHash: null, note: `topic ${sealed.topicId} seq ${sealed.sequenceNumber}` } });
    return loadOrder(prisma, orderId);
  } catch (error) {
    await prisma.order.updateMany({ where: { id: orderId, sealHash: hash }, data: { sealHash: null } });
    await prisma.orderEvent.create({ data: { orderId, type: 'SEAL_ERROR', txHash: null, note: error.message } });
    throw error;
  }
}
export async function verifyOrder(orderId, prisma = sharedPrisma) {
  const order = await loadOrder(prisma, orderId);
  if (!order) throw new AppError('NOT_FOUND', 'Orden no encontrada', 404);
  if (!order.sealHash || order.sealSequence === null) throw new AppError('NOT_SEALED', 'La orden no está sellada', 409);
  const settled = settleEvent(order);
  const hash = orderHash(canonicalOrder(order, settled));
  let onChain = null;
  if (getHederaMode() === 'testnet') { const message = await fetchMirrorMessage(order.sealTopicId, order.sealSequence); onChain = message === null ? null : message.includes(order.sealHash); }
  return { valid: hash === order.sealHash, hash, sealedHash: order.sealHash, onChain };
}
