import { Router } from 'express';
import { AppError } from '../utils/errors.js';
import { bodyObject, integerId } from '../utils/validate.js';
import { confirmDelivery, createOrder, dispatch, fund, serialize } from '../services/orderService.js';
import { sealOrder, verifyOrder } from '../services/sealService.js';

export function ordersRouter(prisma) {
  const router = Router();
  router.post('/', async (req, res, next) => { try {
    bodyObject(req.body); const b = req.body; const millId = integerId(b.millId, 'millId'); const buyerId = integerId(b.buyerId, 'buyerId');
    if (req.party.role !== 'MOLINO' || millId !== req.party.id) throw new AppError('FORBIDDEN', 'Sólo el molino puede crear sus órdenes', 403);
    const order = await createOrder(prisma, b);
    res.status(201).json(order);
  } catch (e) { next(e); } });
  router.get('/', async (req, res, next) => { try { const orders = await prisma.order.findMany({ where: { OR: [{ millId: req.party.id }, { buyerId: req.party.id }] }, include: { events: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } }); res.json(orders.map(serialize)); } catch (e) { next(e); } });
  router.get('/:id', async (req, res, next) => { try { const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { events: { orderBy: { createdAt: 'asc' } } } }); if (!order) throw new AppError('NOT_FOUND', 'Orden no encontrada', 404); if (order.millId !== req.party.id && order.buyerId !== req.party.id) throw new AppError('FORBIDDEN', 'No tiene acceso a esta orden', 403); res.json(serialize(order)); } catch (e) { next(e); } });
  const action = (fn, role, owner) => async (req, res, next) => { try { const order = await prisma.order.findUnique({ where: { id: req.params.id } }); if (!order) throw new AppError('NOT_FOUND', 'Orden no encontrada', 404); if (req.party.role !== role || order[owner] !== req.party.id) throw new AppError('FORBIDDEN', 'No tiene permisos para esta orden', 403); res.json(await fn(prisma, req.params.id)); } catch (e) { next(e); } };
  router.post('/:id/fund', action(fund, 'COMPRADOR', 'buyerId')); router.post('/:id/dispatch', action(dispatch, 'MOLINO', 'millId')); router.post('/:id/confirm-delivery', action(confirmDelivery, 'COMPRADOR', 'buyerId'));
  router.post('/:id/seal', async (req, res, next) => { try { const order = await prisma.order.findUnique({ where: { id: req.params.id } }); if (!order) throw new AppError('NOT_FOUND', 'Orden no encontrada', 404); if (order.millId !== req.party.id && order.buyerId !== req.party.id) throw new AppError('FORBIDDEN', 'No tiene acceso a esta orden', 403); res.json(serialize(await sealOrder(req.params.id, prisma))); } catch (e) { next(e); } });
  router.get('/:id/verify', async (req, res, next) => { try { const order = await prisma.order.findUnique({ where: { id: req.params.id } }); if (!order) throw new AppError('NOT_FOUND', 'Orden no encontrada', 404); if (order.millId !== req.party.id && order.buyerId !== req.party.id) throw new AppError('FORBIDDEN', 'No tiene acceso a esta orden', 403); res.json(await verifyOrder(req.params.id, prisma)); } catch (e) { next(e); } });
  return router;
}
