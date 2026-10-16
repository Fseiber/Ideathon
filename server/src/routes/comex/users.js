import { Router } from 'express';
import { AppError } from '../../utils/errors.js';
import { bodyObject, email, lengthString, rolesList } from '../../utils/validate.js';
import { requirePermission } from '../../middleware/session.js';
import { USER_ROLES } from '../../services/permissions.js';
import { hashPassword } from '../../utils/password.js';
import { audit } from '../../services/audit.js';
import { serializeUser } from '../auth.js';

export const MIN_PASSWORD = 10;

export function usersRouter(prisma) {
  const router = Router();

  router.get('/users', requirePermission('users:manage'), async (_req, res, next) => { try {
    res.json((await prisma.user.findMany({ orderBy: { id: 'asc' } })).map(serializeUser));
  } catch (e) { next(e); } });

  router.post('/users', requirePermission('users:manage'), async (req, res, next) => { try {
    const b = bodyObject(req.body);
    const data = { email: email(b.email, 'email'), name: lengthString(b.name, 'name', 2, 120), roles: rolesList(b.roles, 'roles', USER_ROLES).join(',') };
    if (typeof b.password !== 'string' || b.password.length < MIN_PASSWORD || b.password.length > 200) throw new AppError('VALIDATION_ERROR', `password debe tener al menos ${MIN_PASSWORD} caracteres`);
    if (await prisma.user.findUnique({ where: { email: data.email } })) throw new AppError('CONFLICT', 'Ya existe un usuario con ese email', 409);
    const passwordHash = await hashPassword(b.password);
    const user = await prisma.$transaction(async tx => {
      const created = await tx.user.create({ data: { ...data, passwordHash } });
      await audit(tx, req.user.id, 'user.create', 'User', created.id, data);
      return created;
    });
    res.status(201).json(serializeUser(user));
  } catch (e) { next(e); } });

  return router;
}
