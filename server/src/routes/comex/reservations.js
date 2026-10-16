import { Router } from 'express';
import { AppError } from '../../utils/errors.js';
import { bodyObject, integerId, lengthString, optionalLengthString } from '../../utils/validate.js';
import { requirePermission } from '../../middleware/session.js';
import { ACTIVE_STATUSES, CONFIRMATION_CHANNELS, confirmReservation, createReservation, expireDueReservations, releaseReservation } from '../../services/reservationService.js';
import { EDITABLE_STATUSES, buildMatching, findRequest } from './requests.js';

const include = {
  lot: { select: { id: true, product: true, variety: true, supplier: { select: { id: true, name: true } } } },
  confirmedBy: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
};

export function serializeReservation(r) {
  return { id: r.id, lotId: r.lotId, lot: r.lot, requestId: r.requestId, tons: r.tons, status: r.status, expiresAt: r.expiresAt, confirmedAt: r.confirmedAt, confirmedBy: r.confirmedBy ?? null, confirmationChannel: r.confirmationChannel, confirmationContact: r.confirmationContact, confirmationReference: r.confirmationReference, releasedAt: r.releasedAt, releaseReason: r.releaseReason, createdBy: r.createdBy, createdAt: r.createdAt };
}

async function listForRequest(prisma, requestId) {
  return (await prisma.lotReservation.findMany({ where: { requestId }, include, orderBy: { id: 'asc' } })).map(serializeReservation);
}

async function openRequest(prisma, id) {
  const request = await findRequest(prisma, id);
  if (!EDITABLE_STATUSES.includes(request.status)) throw new AppError('INVALID_STATE', `No se pueden solicitar reservas para una solicitud en estado ${request.status}`, 409);
  return request;
}

const withInclude = (prisma, r) => prisma.lotReservation.findUnique({ where: { id: r.id }, include }).then(serializeReservation);

export function reservationsRouter(prisma) {
  const router = Router();

  router.get('/requests/:id/reservations', requirePermission('reservations:read'), async (req, res, next) => { try {
    const request = await findRequest(prisma, integerId(req.params.id, 'id'));
    await expireDueReservations(prisma);
    const reservations = await listForRequest(prisma, request.id);
    const confirmedTons = reservations.filter(r => r.status === 'CONFIRMADA').reduce((sum, r) => sum + r.tons, 0);
    res.json({ requestId: request.id, requestTons: request.tons, confirmedTons, reservations });
  } catch (e) { next(e); } });

  router.post('/requests/:id/reservations', requirePermission('reservations:write'), async (req, res, next) => { try {
    const request = await openRequest(prisma, integerId(req.params.id, 'id'));
    const b = bodyObject(req.body);
    const created = await createReservation(prisma, { requestId: request.id, lotId: integerId(b.lotId, 'lotId'), tons: b.tons, expiresAt: b.expiresAt, userId: req.user.id });
    res.status(201).json(await withInclude(prisma, created));
  } catch (e) { next(e); } });

  // Idempotente: no duplica si ya existe una reserva SOLICITADA o CONFIRMADA para el mismo lote y solicitud.
  router.post('/requests/:id/reservations/from-proposal', requirePermission('reservations:write'), async (req, res, next) => { try {
    const request = await openRequest(prisma, integerId(req.params.id, 'id'));
    const { proposal } = await buildMatching(prisma, request);
    const active = await prisma.lotReservation.findMany({ where: { requestId: request.id, status: { in: ACTIVE_STATUSES } } });
    const covered = new Set(active.map(r => r.lotId));
    const created = [];
    for (const line of proposal.lines) {
      if (covered.has(line.lotId)) continue;
      created.push((await createReservation(prisma, { requestId: request.id, lotId: line.lotId, tons: line.tons, userId: req.user.id })).id);
      covered.add(line.lotId);
    }
    res.status(created.length ? 201 : 200).json({ created, reservations: await listForRequest(prisma, request.id) });
  } catch (e) { next(e); } });

  router.post('/reservations/:id/confirm', requirePermission('reservations:write'), async (req, res, next) => { try {
    const id = integerId(req.params.id, 'id');
    const b = bodyObject(req.body);
    const channel = typeof b.channel === 'string' ? b.channel.trim().toUpperCase() : '';
    if (!CONFIRMATION_CHANNELS.includes(channel)) throw new AppError('VALIDATION_ERROR', `channel debe ser uno de: ${CONFIRMATION_CHANNELS.join(', ')}`);
    const contact = lengthString(b.contact, 'contact', 2, 120);
    const reference = optionalLengthString(b.reference, 'reference', 1, 120);
    res.json(await withInclude(prisma, await confirmReservation(prisma, id, { channel, contact, reference, userId: req.user.id })));
  } catch (e) { next(e); } });

  router.post('/reservations/:id/release', requirePermission('reservations:write'), async (req, res, next) => { try {
    const id = integerId(req.params.id, 'id');
    const b = bodyObject(req.body);
    const reason = lengthString(b.reason, 'reason', 2, 200);
    res.json(await withInclude(prisma, await releaseReservation(prisma, id, { reason, userId: req.user.id })));
  } catch (e) { next(e); } });

  return router;
}
