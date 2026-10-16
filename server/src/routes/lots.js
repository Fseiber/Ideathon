import { Router } from 'express';
import { AppError } from '../utils/errors.js';
import { bodyObject, positiveInteger, positiveNumber, requiredString, optionalPercent } from '../utils/validate.js';
import { createLot, serializeLot } from '../services/lotService.js';
import { expireDueReservations } from '../services/reservationService.js';

export function lotsRouter(prisma) {
  const router = Router();
  router.post('/', async (req, res, next) => { try {
    if (req.party.role !== 'MOLINO') throw new AppError('FORBIDDEN', 'Sólo el molino puede crear lotes', 403);
    bodyObject(req.body); const b = req.body; const tons = positiveInteger(b.tons, 'tons', 100000); const product = b.product === undefined ? undefined : requiredString(b.product, 'product');
    const optionalString = (value, field) => { if (value === undefined) return undefined; const result = requiredString(value, field); if (result.length < 2 || result.length > 60) throw new AppError('VALIDATION_ERROR', `${field} debe tener entre 2 y 60 caracteres`); return result; };
    const variety = optionalString(b.variety, 'variety'); const province = optionalString(b.province, 'province'); const presentation = optionalString(b.presentation, 'presentation');
    const brokenPct = b.brokenPct === undefined ? undefined : optionalPercent(b.brokenPct, 'brokenPct'); const moisturePct = b.moisturePct === undefined ? undefined : optionalPercent(b.moisturePct, 'moisturePct'); const pricePerTonUsd = b.pricePerTonUsd === undefined ? undefined : positiveNumber(b.pricePerTonUsd, 'pricePerTonUsd', 100000);
    res.status(201).json(serializeLot(await createLot(req.party.id, tons, prisma, product, { variety, province, presentation, brokenPct, moisturePct, pricePerTonCents: pricePerTonUsd === undefined ? undefined : Math.round(pricePerTonUsd * 100) })));
  } catch (e) { next(e); } });
  router.get('/', async (_req, res, next) => { try { await expireDueReservations(prisma); const lots = await prisma.lot.findMany({ orderBy: { id: 'asc' }, include: { supplier: { select: { id: true, name: true } } } }); res.json(lots.map(serializeLot)); } catch (e) { next(e); } });
  return router;
}
