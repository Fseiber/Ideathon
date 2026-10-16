import { AppError } from '../utils/errors.js';
import { audit } from './audit.js';

// Reservas comerciales COMEX (F3A). Una reserva SOLICITADA no compromete stock; sólo la CONFIRMADA
// incrementa Lot.tonsReserved hasta su vencimiento. Este servicio nunca modifica Lot.tonsAvailable:
// eso sigue siendo exclusivo del flujo Stellar (orderService.fund).

export const RESERVATION_STATUSES = ['SOLICITADA', 'CONFIRMADA', 'LIBERADA', 'VENCIDA', 'CONSUMIDA'];
export const ACTIVE_STATUSES = ['SOLICITADA', 'CONFIRMADA'];
export const CONFIRMATION_CHANNELS = ['EMAIL', 'TELEFONO', 'WHATSAPP', 'PRESENCIAL', 'OTRO'];
export const DEFAULT_TTL_MS = 72 * 60 * 60 * 1000;
export const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function commercialAvailable(lot) {
  return lot.tonsAvailable - (lot.tonsReserved ?? 0);
}

// SQLite devuelve SQLITE_BUSY/locked cuando otra escritura tiene el lock; Prisma lo expone como P2034 o en el mensaje.
function isBusy(error) {
  return error?.code === 'P2034' || error?.code === 'P2028' || /database is locked|SQLITE_BUSY|busy|timed out/i.test(String(error?.message ?? ''));
}

async function retryable(fn) {
  try { return await fn(); }
  catch (error) {
    if (error instanceof AppError) throw error;
    if (isBusy(error)) throw new AppError('RETRY_LATER', 'Otra operación está modificando el stock; reintentá en unos segundos', 409);
    throw error;
  }
}

// Idempotente: cada reserva vencida se procesa una sola vez gracias al updateMany condicional por estado.
export async function expireDueReservations(prisma, now = new Date()) {
  const due = await prisma.lotReservation.findMany({ where: { status: { in: ACTIVE_STATUSES }, expiresAt: { lte: now } }, orderBy: { id: 'asc' } });
  let expired = 0;
  for (const reservation of due) {
    try {
      const done = await prisma.$transaction(async tx => {
        const r = await tx.lotReservation.updateMany({ where: { id: reservation.id, status: reservation.status }, data: { status: 'VENCIDA', releasedAt: now, releaseReason: 'Vencimiento' } });
        if (r.count !== 1) return false;
        if (reservation.status === 'CONFIRMADA') await tx.$executeRaw`UPDATE "Lot" SET "tonsReserved" = "tonsReserved" - ${reservation.tons} WHERE "id" = ${reservation.lotId} AND "tonsReserved" >= ${reservation.tons}`;
        await audit(tx, null, 'reservation.expire', 'LotReservation', reservation.id, { from: reservation.status, lotId: reservation.lotId, tons: reservation.tons });
        return true;
      });
      if (done) expired += 1;
    } catch (error) {
      // Si otra llamada concurrente la está venciendo, la próxima lectura la verá resuelta.
      if (!isBusy(error)) throw error;
    }
  }
  return expired;
}

export function parseExpiresAt(value, now = new Date()) {
  if (value === undefined || value === null || value === '') return new Date(now.getTime() + DEFAULT_TTL_MS);
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new AppError('VALIDATION_ERROR', 'expiresAt debe ser una fecha y hora ISO válida');
  if (date <= now) throw new AppError('VALIDATION_ERROR', 'expiresAt debe ser futura');
  if (date.getTime() - now.getTime() > MAX_TTL_MS) throw new AppError('VALIDATION_ERROR', 'expiresAt no puede superar 30 días');
  return date;
}

export async function createReservation(prisma, { requestId = null, lotId, tons, expiresAt, userId }) {
  if (!Number.isInteger(tons) || tons < 1) throw new AppError('VALIDATION_ERROR', 'tons debe ser un entero mayor o igual a 1');
  const expires = parseExpiresAt(expiresAt);
  await expireDueReservations(prisma);
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) throw new AppError('NOT_FOUND', 'Lote no encontrado', 404);
  // Control informativo: la garantía real contra sobreventa está en confirmReservation.
  const available = commercialAvailable(lot);
  if (tons > available) throw new AppError('INSUFFICIENT_STOCK', `El lote #${lotId} tiene ${available} tn comercialmente disponibles`, 409);
  return prisma.$transaction(async tx => {
    const created = await tx.lotReservation.create({ data: { lotId, requestId, tons, expiresAt: expires, createdById: userId } });
    await audit(tx, userId, 'reservation.create', 'LotReservation', created.id, { lotId, requestId, tons, expiresAt: expires.toISOString() });
    return created;
  });
}

export async function confirmReservation(prisma, id, { channel, contact, reference = null, userId }) {
  await expireDueReservations(prisma);
  const now = new Date();
  return retryable(() => prisma.$transaction(async tx => {
    const reservation = await tx.lotReservation.findUnique({ where: { id } });
    if (!reservation) throw new AppError('NOT_FOUND', 'Reserva no encontrada', 404);
    const moved = await tx.lotReservation.updateMany({ where: { id, status: 'SOLICITADA', expiresAt: { gt: now } }, data: { status: 'CONFIRMADA', confirmedAt: now, confirmedById: userId, confirmationChannel: channel, confirmationContact: contact, confirmationReference: reference } });
    if (moved.count === 0) throw new AppError('INVALID_STATE', `La reserva no puede confirmarse (estado ${reservation.status}${reservation.expiresAt <= now ? ', vencida' : ''})`, 409);
    const n = await tx.$executeRaw`UPDATE "Lot" SET "tonsReserved" = "tonsReserved" + ${reservation.tons} WHERE "id" = ${reservation.lotId} AND "tonsAvailable" - "tonsReserved" >= ${reservation.tons}`;
    // Al lanzar dentro de la transacción se revierte también el paso a CONFIRMADA.
    if (n === 0) throw new AppError('INSUFFICIENT_STOCK', `No hay ${reservation.tons} tn comercialmente disponibles en el lote #${reservation.lotId}`, 409);
    await audit(tx, userId, 'reservation.confirm', 'LotReservation', id, { lotId: reservation.lotId, tons: reservation.tons, channel, contact, reference });
    return tx.lotReservation.findUnique({ where: { id } });
  }));
}

export async function releaseReservation(prisma, id, { reason, userId }) {
  await expireDueReservations(prisma);
  const now = new Date();
  return retryable(() => prisma.$transaction(async tx => {
    const reservation = await tx.lotReservation.findUnique({ where: { id } });
    if (!reservation) throw new AppError('NOT_FOUND', 'Reserva no encontrada', 404);
    const data = { status: 'LIBERADA', releasedAt: now, releaseReason: reason };
    let from = null;
    if ((await tx.lotReservation.updateMany({ where: { id, status: 'CONFIRMADA' }, data })).count === 1) {
      from = 'CONFIRMADA';
      await tx.$executeRaw`UPDATE "Lot" SET "tonsReserved" = "tonsReserved" - ${reservation.tons} WHERE "id" = ${reservation.lotId} AND "tonsReserved" >= ${reservation.tons}`;
    } else if ((await tx.lotReservation.updateMany({ where: { id, status: 'SOLICITADA' }, data })).count === 1) {
      from = 'SOLICITADA';
    } else {
      throw new AppError('INVALID_STATE', `La reserva no puede liberarse (estado ${reservation.status})`, 409);
    }
    await audit(tx, userId, 'reservation.release', 'LotReservation', id, { from, lotId: reservation.lotId, tons: reservation.tons, reason });
    return tx.lotReservation.findUnique({ where: { id } });
  }));
}
