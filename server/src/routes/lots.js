import { Router } from 'express';
import { AppError } from '../utils/errors.js';
import { bodyObject, positiveInteger } from '../utils/validate.js';
import { createLot, serializeLot } from '../services/lotService.js';

export function lotsRouter(prisma) {
  const router = Router();
  router.post('/', async (req, res, next) => { try {
    if (req.party.role !== 'MOLINO') throw new AppError('FORBIDDEN', 'Sólo el molino puede crear lotes', 403);
    bodyObject(req.body); const tons = positiveInteger(req.body.tons, 'tons', 100000); const product = req.body.product === undefined ? undefined : (typeof req.body.product === 'string' && req.body.product.trim() ? req.body.product.trim() : (() => { throw new AppError('VALIDATION_ERROR', 'product inválido'); })());
    res.status(201).json(serializeLot(await createLot(req.party.id, tons, prisma, product)));
  } catch (e) { next(e); } });
  router.get('/', async (_req, res, next) => { try { const lots = await prisma.lot.findMany({ orderBy: { id: 'asc' } }); res.json(lots.map(serializeLot)); } catch (e) { next(e); } });
  return router;
}
