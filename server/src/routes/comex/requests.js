import { Router } from 'express';
import { AppError } from '../../utils/errors.js';
import { bodyObject, integerId, lengthString, optionalLengthString } from '../../utils/validate.js';
import { requirePermission } from '../../middleware/session.js';
import { parseRoles } from '../../services/permissions.js';
import { audit } from '../../services/audit.js';
import { availableTons, proposeAllocation, rankMatches } from '../../services/comexMatching.js';
import { expireDueReservations } from '../../services/reservationService.js';

export const REQUEST_STATUSES = ['ABIERTA', 'EN_ANALISIS', 'COTIZADA', 'CERRADA', 'CANCELADA'];
export const INCOTERMS = ['FOB', 'CFR'];
export const EDITABLE_STATUSES = ['ABIERTA', 'EN_ANALISIS'];
// COTIZADA y CERRADA quedan reservadas para F3.
const TRANSITIONS = { ABIERTA: ['EN_ANALISIS', 'CANCELADA'], EN_ANALISIS: ['ABIERTA', 'CANCELADA'] };
const FIELDS = ['buyerCompanyId', 'product', 'variety', 'tons', 'maxBrokenPct', 'maxMoisturePct', 'presentation', 'destination', 'incoterm', 'requiredBy', 'certifications', 'notes'];
const include = { buyer: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } };

function optionalPct(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new AppError('VALIDATION_ERROR', `${field} debe estar entre 0 y 100`);
  return value;
}

function optionalFutureDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(value) ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new AppError('VALIDATION_ERROR', `${field} debe ser una fecha ISO válida`);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (date < today) throw new AppError('VALIDATION_ERROR', `${field} no puede ser anterior a la fecha actual`);
  return date;
}

function requestFields(b, partial) {
  const unknown = Object.keys(b).filter(k => !FIELDS.includes(k));
  if (unknown.length) throw new AppError('VALIDATION_ERROR', `Campos no editables: ${unknown.join(', ')}`);
  const has = k => !partial || b[k] !== undefined;
  const data = {};
  if (has('buyerCompanyId')) data.buyerCompanyId = integerId(b.buyerCompanyId, 'buyerCompanyId');
  if (b.product !== undefined) data.product = lengthString(b.product, 'product', 2, 60);
  if (has('variety')) data.variety = lengthString(b.variety, 'variety', 2, 60);
  if (has('tons')) { if (!Number.isInteger(b.tons) || b.tons < 1 || b.tons > 100000) throw new AppError('VALIDATION_ERROR', 'tons debe ser un entero entre 1 y 100000'); data.tons = b.tons; }
  if (has('maxBrokenPct')) data.maxBrokenPct = optionalPct(b.maxBrokenPct, 'maxBrokenPct');
  if (has('maxMoisturePct')) data.maxMoisturePct = optionalPct(b.maxMoisturePct, 'maxMoisturePct');
  if (has('presentation')) data.presentation = optionalLengthString(b.presentation, 'presentation', 2, 60);
  if (has('destination')) data.destination = lengthString(b.destination, 'destination', 2, 80);
  if (has('incoterm')) { const incoterm = typeof b.incoterm === 'string' ? b.incoterm.trim().toUpperCase() : ''; if (!INCOTERMS.includes(incoterm)) throw new AppError('VALIDATION_ERROR', 'incoterm debe ser FOB o CFR'); data.incoterm = incoterm; }
  if (has('requiredBy')) data.requiredBy = optionalFutureDate(b.requiredBy, 'requiredBy');
  if (has('certifications')) data.certifications = optionalLengthString(b.certifications, 'certifications', 2, 200);
  if (has('notes')) data.notes = optionalLengthString(b.notes, 'notes', 1, 2000);
  return data;
}

async function assertBuyer(prisma, id) {
  const buyer = await prisma.company.findUnique({ where: { id } });
  if (!buyer) throw new AppError('NOT_FOUND', 'Empresa compradora no encontrada', 404);
  if (!parseRoles(buyer.roles).includes('COMPRADOR')) throw new AppError('VALIDATION_ERROR', 'La empresa debe tener rol COMPRADOR');
}

export async function findRequest(prisma, id) {
  const request = await prisma.purchaseRequest.findUnique({ where: { id }, include });
  if (!request) throw new AppError('NOT_FOUND', 'Solicitud no encontrada', 404);
  return request;
}

const auditable = data => Object.fromEntries(FIELDS.filter(k => data[k] !== undefined).map(k => [k, data[k] instanceof Date ? data[k].toISOString() : data[k]]));

export function serializeRequest(r) {
  return { id: r.id, buyer: r.buyer, product: r.product, variety: r.variety, tons: r.tons, maxBrokenPct: r.maxBrokenPct, maxMoisturePct: r.maxMoisturePct, presentation: r.presentation, destination: r.destination, incoterm: r.incoterm, requiredBy: r.requiredBy, certifications: r.certifications, status: r.status, notes: r.notes, createdBy: r.createdBy, createdAt: r.createdAt, updatedAt: r.updatedAt, allowedTransitions: TRANSITIONS[r.status] || [] };
}

// Matching sobre la disponibilidad comercial. Las reservas CONFIRMADAS de esta misma solicitud
// se suman de vuelta: el stock que ya le reservaron no debe restarle cobertura a su propia propuesta.
export async function buildMatching(prisma, request) {
  await expireDueReservations(prisma);
  const [rawLots, own] = await Promise.all([
    prisma.lot.findMany({ orderBy: { id: 'asc' }, include: { supplier: { select: { id: true, name: true } } } }),
    prisma.lotReservation.findMany({ where: { requestId: request.id, status: 'CONFIRMADA' } }),
  ]);
  const ownByLot = new Map();
  for (const r of own) ownByLot.set(r.lotId, (ownByLot.get(r.lotId) ?? 0) + r.tons);
  const lots = rawLots.map(l => ({ ...l, tonsReserved: Math.max(0, (l.tonsReserved ?? 0) - (ownByLot.get(l.id) ?? 0)) }));
  const lotsById = new Map(lots.map(l => [l.id, l]));
  const results = rankMatches(request, lots).map(m => { const lot = lotsById.get(m.lotId); return { ...m, lot: { id: lot.id, product: lot.product, variety: lot.variety, presentation: lot.presentation, brokenPct: lot.brokenPct, moisturePct: lot.moisturePct, tonsAvailable: lot.tonsAvailable, commercialAvailable: availableTons(lot), pricePerTonCents: lot.pricePerTonCents, supplier: lot.supplier } }; });
  const confirmedTons = own.reduce((sum, r) => sum + r.tons, 0);
  return { request: serializeRequest(request), results, proposal: proposeAllocation(request, lots, { confirmedTons }), confirmedTons };
}

export function requestsRouter(prisma) {
  const router = Router();

  router.get('/requests', requirePermission('requests:read'), async (req, res, next) => { try {
    const where = {};
    if (typeof req.query.status === 'string' && req.query.status) {
      const status = req.query.status.toUpperCase();
      if (!REQUEST_STATUSES.includes(status)) throw new AppError('VALIDATION_ERROR', `status debe ser uno de: ${REQUEST_STATUSES.join(', ')}`);
      where.status = status;
    }
    if (req.query.buyerCompanyId !== undefined && req.query.buyerCompanyId !== '') where.buyerCompanyId = integerId(req.query.buyerCompanyId, 'buyerCompanyId');
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
    if (q) where.OR = [{ variety: { contains: q } }, { destination: { contains: q } }, { notes: { contains: q } }, { buyer: { name: { contains: q } } }];
    const requests = await prisma.purchaseRequest.findMany({ where, include, orderBy: { id: 'desc' } });
    res.json(requests.map(serializeRequest));
  } catch (e) { next(e); } });

  router.post('/requests', requirePermission('requests:write'), async (req, res, next) => { try {
    const data = requestFields(bodyObject(req.body), false);
    await assertBuyer(prisma, data.buyerCompanyId);
    const created = await prisma.$transaction(async tx => {
      const row = await tx.purchaseRequest.create({ data: { ...data, createdById: req.user.id }, include });
      await audit(tx, req.user.id, 'request.create', 'PurchaseRequest', row.id, auditable(data));
      return row;
    });
    res.status(201).json(serializeRequest(created));
  } catch (e) { next(e); } });

  router.get('/requests/:id', requirePermission('requests:read'), async (req, res, next) => { try {
    res.json(serializeRequest(await findRequest(prisma, integerId(req.params.id, 'id'))));
  } catch (e) { next(e); } });

  router.patch('/requests/:id', requirePermission('requests:write'), async (req, res, next) => { try {
    const id = integerId(req.params.id, 'id');
    const data = requestFields(bodyObject(req.body), true);
    const before = await findRequest(prisma, id);
    if (!EDITABLE_STATUSES.includes(before.status)) throw new AppError('INVALID_STATE', `No se puede editar una solicitud en estado ${before.status}`, 409);
    if (data.buyerCompanyId !== undefined) await assertBuyer(prisma, data.buyerCompanyId);
    const previous = auditable(before);
    const changes = Object.fromEntries(Object.entries(auditable(data)).filter(([k, v]) => previous[k] !== v).map(([k, v]) => [k, { from: previous[k], to: v }]));
    const updated = await prisma.$transaction(async tx => {
      // Actualización condicional: si otro usuario cambió el estado entretanto, no se edita.
      const { count } = await tx.purchaseRequest.updateMany({ where: { id, status: { in: EDITABLE_STATUSES } }, data });
      if (count === 0) throw new AppError('INVALID_STATE', 'La solicitud cambió de estado y ya no es editable', 409);
      await audit(tx, req.user.id, 'request.update', 'PurchaseRequest', id, changes);
      return tx.purchaseRequest.findUnique({ where: { id }, include });
    });
    res.json(serializeRequest(updated));
  } catch (e) { next(e); } });

  router.post('/requests/:id/status', requirePermission('requests:write'), async (req, res, next) => { try {
    const id = integerId(req.params.id, 'id');
    bodyObject(req.body);
    const to = typeof req.body.status === 'string' ? req.body.status.trim().toUpperCase() : '';
    if (!REQUEST_STATUSES.includes(to)) throw new AppError('VALIDATION_ERROR', `status debe ser uno de: ${REQUEST_STATUSES.join(', ')}`);
    const before = await findRequest(prisma, id);
    if (!(TRANSITIONS[before.status] || []).includes(to)) throw new AppError('INVALID_TRANSITION', `Transición no permitida: ${before.status} → ${to}`, 409);
    const updated = await prisma.$transaction(async tx => {
      const { count } = await tx.purchaseRequest.updateMany({ where: { id, status: before.status }, data: { status: to } });
      if (count === 0) throw new AppError('INVALID_TRANSITION', 'La solicitud cambió de estado; recargá e intentá de nuevo', 409);
      await audit(tx, req.user.id, 'request.status', 'PurchaseRequest', id, { from: before.status, to });
      return tx.purchaseRequest.findUnique({ where: { id }, include });
    });
    res.json(serializeRequest(updated));
  } catch (e) { next(e); } });

  router.get('/requests/:id/matching', requirePermission('requests:read'), async (req, res, next) => { try {
    res.json(await buildMatching(prisma, await findRequest(prisma, integerId(req.params.id, 'id'))));
  } catch (e) { next(e); } });

  return router;
}
