import { Router } from 'express';
export function partiesRouter(prisma) { const router = Router(); router.get('/', async (_req, res) => res.json(await prisma.party.findMany({ select: { id: true, name: true, role: true, stellarPublicKey: true }, orderBy: { id: 'asc' } }))); return router; }
