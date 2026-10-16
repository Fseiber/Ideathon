import { Router } from 'express';
import { requireUser } from '../../middleware/session.js';
import { companiesRouter } from './companies.js';
import { usersRouter } from './users.js';

export function comexRouter(prisma) {
  const router = Router();
  router.use(requireUser(prisma));
  router.use(companiesRouter(prisma));
  router.use(usersRouter(prisma));
  return router;
}
