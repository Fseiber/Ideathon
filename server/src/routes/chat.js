import { Router } from 'express';
import { AppError } from '../utils/errors.js';
import { handleChat } from '../services/chatService.js';

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 30) throw new AppError('VALIDATION_ERROR', 'messages debe tener entre 1 y 30 elementos');
  for (const message of messages) {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length < 1 || message.content.length > 1000) throw new AppError('VALIDATION_ERROR', 'Cada mensaje debe tener role válido y content entre 1 y 1000 caracteres');
  }
  if (messages.at(-1).role !== 'user') throw new AppError('VALIDATION_ERROR', 'El último mensaje debe ser del usuario');
}

export function chatRouter(prisma) {
  const router = Router();
  router.post('/', async (req, res, next) => { try { if (req.party.role !== 'COMPRADOR') throw new AppError('FORBIDDEN', 'Sólo el comprador puede usar el chat', 403); validateMessages(req.body?.messages); res.json(await handleChat({ buyerId: req.party.id, messages: req.body.messages }, { prisma })); } catch (error) { next(error); } });
  return router;
}
