import dotenv from 'dotenv';
import { AppError } from '../utils/errors.js';
import { explorerUrl, sendArroz, sendUsdc, settleDvP } from './stellar.js';
import { getHederaMode, hashscanUrl } from './hederaService.js';
import { sealOrder } from './sealService.js';
import { integerId, optionalPercent, positiveInteger, positiveNumber, requiredString } from '../utils/validate.js';
import { quote } from './quote.js';
dotenv.config();

const include = { events: { orderBy: { createdAt: 'asc' } } };
export function serialize(order) { const seal = order.sealHash && order.sealTopicId && order.sealSequence !== null ? { hash: order.sealHash, topicId: order.sealTopicId, sequenceNumber: order.sealSequence, hashscanUrl: hashscanUrl(order.sealTopicId, order.sealSequence), mode: getHederaMode() } : null; return { ...order, tokenCode: 'ARROZ', seal, events: (order.events || []).map(e => ({ type: e.type, txHash: e.txHash, explorerUrl: explorerUrl(e.txHash), note: e.note, createdAt: e.createdAt })) }; }
async function changeStatus(prisma, id, expected) { const result = await prisma.order.updateMany({ where: { id, status: expected }, data: { status: 'PROCESANDO' } }); if (result.count === 0) throw new AppError('INVALID_STATE', 'La orden no está en un estado válido', 409); }
async function addEvent(prisma, orderId, type, data = {}) { return prisma.orderEvent.create({ data: { orderId, type, ...data } }); }
function secretFor(role) { return role === 'COMPRADOR' ? process.env.STELLAR_BUYER_SECRET : process.env.STELLAR_ESCROW_SECRET; }

export async function createOrder(prisma, input) {
  const millId = integerId(input.millId, 'millId');
  const buyerId = integerId(input.buyerId, 'buyerId');
  const tons = positiveInteger(input.tons, 'tons');
  const explicitPricePerTonUsd = input.pricePerTonUsd === undefined ? undefined : positiveNumber(input.pricePerTonUsd, 'pricePerTonUsd');
  if (!['FOB', 'CFR'].includes(input.incoterm)) throw new AppError('VALIDATION_ERROR', 'incoterm inválido');
  const destination = requiredString(input.destination, 'destination');
  const exportDutyPct = optionalPercent(input.exportDutyPct, 'exportDutyPct');
  if (input.freightUsd !== undefined && (typeof input.freightUsd !== 'number' || input.freightUsd < 0 || !Number.isFinite(input.freightUsd))) throw new AppError('VALIDATION_ERROR', 'freightUsd inválido');
  const buyer = await prisma.party.findUnique({ where: { id: buyerId } });
  if (!buyer || buyer.role !== 'COMPRADOR') throw new AppError('VALIDATION_ERROR', 'buyerId debe ser un comprador existente');
  const lot = await prisma.lot.findFirst({ where: { millId, tonsAvailable: { gte: tons } }, orderBy: { id: 'asc' } });
  if (!lot) {
    const available = await prisma.lot.aggregate({ where: { millId }, _sum: { tonsAvailable: true } });
    throw new AppError('INSUFFICIENT_STOCK', `No hay stock suficiente. Toneladas disponibles: ${available._sum.tonsAvailable || 0}`, 409);
  }
  const pricePerTonCents = explicitPricePerTonUsd === undefined ? lot.pricePerTonCents : Math.round(explicitPricePerTonUsd * 100);
  const values = quote({ tons, pricePerTonCents, incoterm: input.incoterm, freightCents: Math.round((input.freightUsd || 0) * 100), exportDutyPct });
  return serialize(await prisma.order.create({ data: { millId, buyerId, lotId: lot.id, destination, tons, pricePerTonCents, incoterm: input.incoterm, exportDutyPct, ...values }, include: { events: true } }));
}

export async function fund(prisma, id) {
  await changeStatus(prisma, id, 'COTIZADA');
  const order = await prisma.order.findUnique({ where: { id }, include: { mill: true, buyer: true } });
  try {
    if (!order.stockReserved) {
      const reserved = await prisma.lot.updateMany({ where: { id: order.lotId, tonsAvailable: { gte: order.tons } }, data: { tonsAvailable: { decrement: order.tons } } });
      if (reserved.count === 0) {
        await prisma.order.update({ where: { id }, data: { status: 'COTIZADA' } });
        throw new AppError('INSUFFICIENT_STOCK', `No hay stock suficiente para ${order.tons} toneladas`, 409);
      }
      await prisma.order.update({ where: { id }, data: { stockReserved: true } });
    }
    if (!order.escrowFunded) {
      const first = await sendUsdc({ fromSecret: secretFor('COMPRADOR'), toPublicKey: process.env.STELLAR_ESCROW_PUBLIC, amountCents: order.totalCents, memo: `ARZ-${id.slice(0, 8)}` });
      await addEvent(prisma, id, 'FUND_ESCROW', { txHash: first.txHash });
      await prisma.order.update({ where: { id }, data: { escrowFunded: true } });
    }
    if (!order.tokensEscrowed) {
      const locked = await sendArroz({ fromSecret: process.env.STELLAR_MILL_SECRET, toPublicKey: process.env.STELLAR_ESCROW_PUBLIC, tons: order.tons, memo: `ARZ-${id.slice(0, 8)}` });
      await addEvent(prisma, id, 'LOCK_TOKENS', { txHash: locked.txHash });
      await prisma.order.update({ where: { id }, data: { tokensEscrowed: true } });
    }
    if (!order.advanceReleased) {
      const second = await sendUsdc({ fromSecret: process.env.STELLAR_ESCROW_SECRET, toPublicKey: order.mill.stellarPublicKey, amountCents: order.advanceCents, memo: `ARZ-${id.slice(0, 8)}` });
      await addEvent(prisma, id, 'RELEASE_ADVANCE', { txHash: second.txHash });
      await prisma.order.update({ where: { id }, data: { advanceReleased: true } });
    }
    return serialize(await prisma.order.update({ where: { id }, data: { status: 'FONDEADA' }, include }));
  } catch (error) {
    if (error instanceof AppError && error.code === 'INSUFFICIENT_STOCK') throw error;
    await addEvent(prisma, id, 'ERROR', { note: error.message });
    await prisma.order.update({ where: { id }, data: { status: 'COTIZADA' } });
    throw error;
  }
}
export async function dispatch(prisma, id) { await changeStatus(prisma, id, 'FONDEADA'); await addEvent(prisma, id, 'DISPATCHED'); return serialize(await prisma.order.update({ where: { id }, data: { status: 'DESPACHADA' }, include })); }
export async function confirmDelivery(prisma, id) {
  await changeStatus(prisma, id, 'DESPACHADA'); const order = await prisma.order.findUnique({ where: { id }, include: { mill: true, buyer: true } });
  try { const txResponse = await settleDvP({ usdcCents: order.balanceCents, usdcTo: order.mill.stellarPublicKey, arrozTons: order.tons, arrozTo: order.buyer.stellarPublicKey, memo: `ARZ-${id.slice(0, 8)}` }); const txHash = txResponse?.hash || txResponse?.id || txResponse?.txHash; if (!txHash) throw new AppError('STELLAR_ERROR', 'La liquidación no devolvió un hash de transacción', 502); await addEvent(prisma, id, 'SETTLE_DVP', { txHash }); await prisma.order.update({ where: { id }, data: { status: 'COMPLETADA' } }); if (getHederaMode() !== 'off') { try { await sealOrder(id, prisma); } catch { /* settlement remains completed when sealing fails */ } } return serialize(await prisma.order.findUnique({ where: { id }, include })); }
  catch (error) { await addEvent(prisma, id, 'ERROR', { note: error.message }); await prisma.order.update({ where: { id }, data: { status: 'DESPACHADA' } }); throw error; }
}
