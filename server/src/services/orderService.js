import dotenv from 'dotenv';
import { AppError } from '../utils/errors.js';
import { explorerUrl, sendArroz, sendUsdc, settleDvP } from './stellar.js';
import { getHederaMode, hashscanUrl } from './hederaService.js';
import { sealOrder } from './sealService.js';
import { integerId, optionalPercent, positiveInteger, positiveNumber, requiredString } from '../utils/validate.js';
import { quote } from './quote.js';
import { commercialAvailable, expireDueReservations } from './reservationService.js';
dotenv.config();

const include = { events: { orderBy: { createdAt: 'asc' } } };
export function stepMemo(orderId, step) { return `ARZ-${orderId.slice(0, 8)}-${step}`; }
export function serialize(order) { const seal = order.sealHash && order.sealTopicId && order.sealSequence !== null ? { hash: order.sealHash, topicId: order.sealTopicId, sequenceNumber: order.sealSequence, hashscanUrl: hashscanUrl(order.sealTopicId, order.sealSequence), mode: getHederaMode() } : null; return { ...order, tokenCode: 'ARROZ', seal, events: (order.events || []).map(e => ({ type: e.type, txHash: e.txHash, explorerUrl: explorerUrl(e.txHash), note: e.note, createdAt: e.createdAt })) }; }
async function changeStatus(prisma, id, expected) { const result = await prisma.order.updateMany({ where: { id, status: expected }, data: { status: 'PROCESANDO' } }); if (result.count === 0) throw new AppError('INVALID_STATE', 'La orden no está en un estado válido', 409); }
async function addEvent(prisma, orderId, type, data = {}) { return prisma.orderEvent.create({ data: { orderId, type, ...data } }); }
async function addTransactionEvent(prisma, orderId, type, txResponse) { const existing = await prisma.orderEvent.findFirst({ where: { orderId, type } }); if (existing) return existing; return addEvent(prisma, orderId, type, { txHash: txResponse.txHash, ...(txResponse.reconciled ? { note: 'reconciliado desde Horizon' } : {}) }); }
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
  let lot;
  if (input.lotId !== undefined) {
    const requestedLotId = integerId(input.lotId, 'lotId');
    lot = await prisma.lot.findUnique({ where: { id: requestedLotId } });
    if (!lot) throw new AppError('NOT_FOUND', 'Lote no encontrado', 404);
    if (lot.millId !== millId) throw new AppError('VALIDATION_ERROR', 'El lote no pertenece al molino');
    // Disponibilidad comercial = tonsAvailable − reservas COMEX confirmadas.
    if (commercialAvailable(lot) < tons) throw new AppError('INSUFFICIENT_STOCK', `No hay stock suficiente en el lote #${requestedLotId}. Disponibles: ${commercialAvailable(lot)}`, 409);
  } else {
    const lots = await prisma.lot.findMany({ where: { millId }, orderBy: { id: 'asc' } });
    lot = lots.find(candidate => commercialAvailable(candidate) >= tons);
    if (!lot) throw new AppError('INSUFFICIENT_STOCK', `No hay stock suficiente. Toneladas disponibles: ${lots.reduce((sum, candidate) => sum + Math.max(0, commercialAvailable(candidate)), 0)}`, 409);
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
      await expireDueReservations(prisma);
      // Descuento atómico que respeta las reservas COMEX confirmadas (tonsReserved).
      const reserved = await prisma.$executeRaw`UPDATE "Lot" SET "tonsAvailable" = "tonsAvailable" - ${order.tons} WHERE "id" = ${order.lotId} AND "tonsAvailable" - "tonsReserved" >= ${order.tons}`;
      if (reserved === 0) {
        await prisma.order.update({ where: { id }, data: { status: 'COTIZADA' } });
        throw new AppError('INSUFFICIENT_STOCK', `No hay stock suficiente para ${order.tons} toneladas`, 409);
      }
      await prisma.order.update({ where: { id }, data: { stockReserved: true } });
    }
    if (!order.escrowFunded) {
      const first = await sendUsdc({ fromSecret: secretFor('COMPRADOR'), toPublicKey: process.env.STELLAR_ESCROW_PUBLIC, amountCents: order.totalCents, memo: stepMemo(id, 'F') });
      await addTransactionEvent(prisma, id, 'FUND_ESCROW', first);
      await prisma.order.update({ where: { id }, data: { escrowFunded: true } });
    }
    if (!order.tokensEscrowed) {
      const locked = await sendArroz({ fromSecret: process.env.STELLAR_MILL_SECRET, toPublicKey: process.env.STELLAR_ESCROW_PUBLIC, tons: order.tons, memo: stepMemo(id, 'L') });
      await addTransactionEvent(prisma, id, 'LOCK_TOKENS', locked);
      await prisma.order.update({ where: { id }, data: { tokensEscrowed: true } });
    }
    if (!order.advanceReleased) {
      const second = await sendUsdc({ fromSecret: process.env.STELLAR_ESCROW_SECRET, toPublicKey: order.mill.stellarPublicKey, amountCents: order.advanceCents, memo: stepMemo(id, 'A') });
      await addTransactionEvent(prisma, id, 'RELEASE_ADVANCE', second);
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
  try { const txResponse = await settleDvP({ usdcCents: order.balanceCents, usdcTo: order.mill.stellarPublicKey, arrozTons: order.tons, arrozTo: order.buyer.stellarPublicKey, memo: stepMemo(id, 'S') }); const txHash = txResponse?.txHash; if (!txHash) throw new AppError('STELLAR_ERROR', 'La liquidación no devolvió un hash de transacción', 502); await addTransactionEvent(prisma, id, 'SETTLE_DVP', txResponse); await prisma.order.update({ where: { id }, data: { status: 'COMPLETADA' } }); if (getHederaMode() !== 'off') { try { await sealOrder(id, prisma); } catch { /* settlement remains completed when sealing fails */ } } return serialize(await prisma.order.findUnique({ where: { id }, include })); }
  catch (error) { await addEvent(prisma, id, 'ERROR', { note: error.message }); await prisma.order.update({ where: { id }, data: { status: 'DESPACHADA' } }); throw error; }
}
