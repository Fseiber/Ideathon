import { Router } from 'express';
import { AppError } from '../utils/errors.js';
import { bodyObject } from '../utils/validate.js';
import { hashPassword, newSessionToken, sha256, verifyPassword } from '../utils/password.js';
import { requireUser } from '../middleware/session.js';
import { parseRoles } from '../services/permissions.js';

// Hash ficticio: un email inexistente cuesta lo mismo que una contraseña errónea.
let dummyHash;
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export function serializeUser(user) { return { id: user.id, email: user.email, name: user.name, roles: Array.isArray(user.roles) ? user.roles : parseRoles(user.roles), active: user.active }; }

export function authRouter(prisma) {
  const router = Router();
  router.post('/login', async (req, res, next) => { try {
    bodyObject(req.body);
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    dummyHash ||= hashPassword('dummy-password-timing');
    const ok = await verifyPassword(password, user ? user.passwordHash : await dummyHash) && Boolean(user);
    if (!ok || !user.active) throw new AppError('INVALID_CREDENTIALS', 'Credenciales inválidas', 401);
    const token = newSessionToken();
    await prisma.session.create({ data: { tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
    const { active: _active, ...publicUser } = serializeUser(user);
    res.json({ token, user: publicUser });
  } catch (e) { next(e); } });
  router.post('/logout', requireUser(prisma), async (req, res, next) => { try { await prisma.session.deleteMany({ where: { id: req.sessionId } }); res.status(204).end(); } catch (e) { next(e); } });
  router.get('/me', requireUser(prisma), (req, res) => res.json(serializeUser(req.user)));
  return router;
}
