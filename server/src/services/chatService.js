import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/errors.js';
import { createOrder, serialize } from './orderService.js';
import stubAgent from './stubAgent.js';
dotenv.config();

const sharedPrisma = new PrismaClient();
const invalidReply = 'No pude interpretar el pedido. ¿Me confirmás toneladas (número entero), destino e Incoterm (FOB o CFR)?';
function validAgentResult(result) { return result && typeof result.reply === 'string' && (result.intent === null || (result.intent && typeof result.intent === 'object')); }
function validIntent(intent) { return Number.isInteger(intent.tons) && intent.tons >= 1 && typeof intent.destination === 'string' && intent.destination.trim().length >= 2 && intent.destination.trim().length <= 80 && ['FOB', 'CFR'].includes(intent.incoterm); }
async function runWithTimeout(agent, messages, timeoutMs) { let timer; try { return await Promise.race([agent(messages), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('agent timeout')), timeoutMs); })]); } finally { clearTimeout(timer); } }
async function resolveAgent(messages, deps) {
  let primary = deps.primaryAgent;
  if (!primary) {
    if ((process.env.AGENT_MODE || 'stub') === 'gemini') {
      try { primary = (await import('../agent/index.js')).runAgent; } catch { primary = null; }
    } else primary = stubAgent;
  }
  if (primary) {
    try { const result = await runWithTimeout(primary, messages, Number(process.env.AGENT_TIMEOUT_MS || 15000)); if (validAgentResult(result)) return { result, agent: (process.env.AGENT_MODE || 'stub') === 'gemini' ? 'gemini' : 'stub' }; } catch { /* fallback below */ }
  }
  const fallback = deps.fallbackAgent || stubAgent;
  try { const result = await runWithTimeout(fallback, messages, Number(process.env.AGENT_TIMEOUT_MS || 15000)); if (validAgentResult(result)) return { result, agent: 'stub' }; } catch { /* handled as an unrecognized request */ }
  return { result: { reply: invalidReply, intent: null }, agent: 'stub' };
}

export async function handleChat({ buyerId, messages }, deps = {}) {
  const prisma = deps.prisma || sharedPrisma;
  const { result, agent } = await resolveAgent(messages, deps);
  if (result.intent === null) return { reply: result.reply, order: null, agent };
  if (!validIntent(result.intent)) return { reply: invalidReply, order: null, agent };
  const intent = { ...result.intent, destination: result.intent.destination.trim() };
  const duplicate = await prisma.order.findFirst({ where: { buyerId, status: 'COTIZADA', tons: intent.tons, destination: intent.destination, incoterm: intent.incoterm, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } }, include: { events: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
  if (duplicate) return { reply: quoteReply(result.reply, duplicate), order: serialize(duplicate), agent };
  const mill = await prisma.party.findFirst({ where: { role: 'MOLINO' }, orderBy: { id: 'asc' } });
  if (!mill) throw new AppError('NOT_FOUND', 'Molino no encontrado', 404);
  try {
    const order = await createOrder(prisma, { millId: mill.id, buyerId, destination: intent.destination, tons: intent.tons, incoterm: intent.incoterm, pricePerTonUsd: Number(process.env.DEMO_PRICE_PER_TON_USD || 600), freightUsd: Number(process.env.DEMO_FREIGHT_USD || 1500), exportDutyPct: Number(process.env.DEMO_EXPORT_DUTY_PCT || 5) });
    return { reply: quoteReply(result.reply, order), order, agent };
  } catch (error) {
    if (error instanceof AppError && error.code === 'INSUFFICIENT_STOCK') { const lot = await prisma.lot.findFirst({ where: { millId: mill.id }, orderBy: { id: 'asc' } }); return { reply: `No tengo stock suficiente: hay ${lot?.tonsAvailable || 0} tn disponibles.`, order: null, agent }; }
    throw error;
  }
}
function quoteReply(reply, order) { return `${reply}\n\nCotización: ${order.tons} tn de arroz a ${order.destination} (${order.incoterm}). Total: ${(order.totalCents / 100).toFixed(2)} USDC. Anticipo: ${(order.advanceCents / 100).toFixed(2)} USDC. Saldo contra entrega: ${(order.balanceCents / 100).toFixed(2)} USDC.`; }
