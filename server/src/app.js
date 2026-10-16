import express from 'express';
import cors from 'cors';
import { auth } from './middleware/auth.js';
import { errorResponse } from './utils/errors.js';
import { partiesRouter } from './routes/parties.js';
import { ordersRouter } from './routes/orders.js';
import { lotsRouter } from './routes/lots.js';
import { chatRouter } from './routes/chat.js';
import { getStellarMode } from './services/stellar.js';
import { getHederaMode } from './services/hederaService.js';
export function createApp(prisma) { const app = express(); app.use(cors()); app.use(express.json()); app.get('/api/health', async (_req, res) => { let db = 'ok'; try { await prisma.$queryRaw`SELECT 1`; } catch { db = 'error'; } const stellarMode = getStellarMode(); res.json({ ok: true, stellarMode, hederaMode: getHederaMode(), agentMode: process.env.AGENT_MODE || 'stub', db, issuerPublic: stellarMode === 'testnet' ? (process.env.STELLAR_ISSUER_PUBLIC || null) : null, escrowPublic: stellarMode === 'testnet' ? (process.env.STELLAR_ESCROW_PUBLIC || null) : null }); }); app.use('/api/parties', partiesRouter(prisma)); app.use('/api/lots', auth(prisma), lotsRouter(prisma)); app.use('/api/orders', auth(prisma), ordersRouter(prisma)); app.use('/api/chat', auth(prisma), chatRouter(prisma)); app.use((err, _req, res, _next) => errorResponse(err, res)); return app; }
