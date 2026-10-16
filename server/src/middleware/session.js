import { AppError } from '../utils/errors.js';
import { sha256 } from '../utils/password.js';
import { hasPermission, parseRoles } from '../services/permissions.js';

export function requireUser(prisma) {
  return async (req, _res, next) => {
    try {
      const match = /^Bearer ([0-9a-f]{64})$/i.exec(req.header('authorization') || '');
      if (!match) throw new AppError('UNAUTHENTICATED', 'Sesión requerida', 401);
      const session = await prisma.session.findUnique({ where: { tokenHash: sha256(match[1].toLowerCase()) }, include: { user: true } });
      if (!session || session.expiresAt <= new Date() || !session.user.active) throw new AppError('UNAUTHENTICATED', 'Sesión inválida o expirada', 401);
      req.user = { ...session.user, roles: parseRoles(session.user.roles) };
      req.sessionId = session.id;
      next();
    } catch (e) { next(e); }
  };
}

export function requirePermission(perm) {
  return (req, _res, next) => {
    if (!req.user || !hasPermission(req.user.roles, perm)) return next(new AppError('FORBIDDEN', 'No tiene permisos para esta operación', 403));
    next();
  };
}
