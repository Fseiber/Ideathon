process.env.STELLAR_MODE = 'mock';
process.env.DATABASE_URL = 'file:./test.db';
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';

const prisma = new PrismaClient(); let server; let base;
const lotData = (pricePerTonCents = 60000, tonsAvailable = 1000) => ({ millId: 1, product: 'Arroz largo fino', variety: 'Largo fino', province: 'Corrientes', presentation: 'Bolsas 25 kg', pricePerTonCents, tonsTotal: 1000, tonsAvailable, mintTxHash: 'a'.repeat(64) });
async function request(path, body, party = '2') { const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-party-id': party }, body: JSON.stringify(body) }); return { response, body: await response.json() }; }
async function chat(content, lotId) { return request('/api/chat', { messages: [{ role: 'user', content }], ...(lotId === undefined ? {} : { lotId }) }); }

before(async () => { await prisma.party.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: 'Molino', role: 'MOLINO', stellarPublicKey: 'G' + '1'.repeat(55) } }); await prisma.party.upsert({ where: { id: 2 }, update: {}, create: { id: 2, name: 'Buyer', role: 'COMPRADOR', stellarPublicKey: 'G' + '2'.repeat(55) } }); server = createApp(prisma).listen(0); base = `http://127.0.0.1:${server.address().port}`; });
beforeEach(async () => { await prisma.orderEvent.deleteMany(); await prisma.order.deleteMany(); await prisma.lot.deleteMany(); await prisma.lot.create({ data: { id: 1, ...lotData() } }); });
after(async () => { server.close(); await prisma.$disconnect(); });

test('sin lotId conserva el primer lote y la cotización previa', async () => { const result = await chat('20 toneladas para Asunción CFR'); assert.equal(result.response.status, 200); assert.equal(result.body.order.lotId, (await prisma.lot.findFirst()).id); assert.equal(result.body.order.totalCents, 1350000); });
test('lotId seleccionado determina lote y precio', async () => { const selected = await prisma.lot.create({ data: lotData(65000) }); const result = await chat('10 toneladas para Brasil FOB', selected.id); assert.equal(result.body.order.lotId, selected.id); assert.equal(result.body.order.totalCents, 650000); });
test('stock insuficiente responde disponibilidad del lote', async () => { const selected = await prisma.lot.update({ where: { id: 1 }, data: { tonsAvailable: 5 } }); const result = await chat('10 toneladas para Brasil FOB', selected.id); assert.equal(result.body.order, null); assert.match(result.body.reply, /5/); assert.equal(await prisma.order.count(), 0); });
test('lote inexistente no crea orden', async () => { const result = await chat('10 toneladas para Brasil FOB', 999999); assert.equal(result.body.order, null); assert.equal(result.body.reply, 'Ese lote ya no está disponible.'); });
test('lotId inválido devuelve validación', async () => { for (const lotId of ['abc', -1]) { const result = await request('/api/chat', { lotId, messages: [{ role: 'user', content: '10 toneladas para Brasil FOB' }] }); assert.equal(result.response.status, 400); assert.equal(result.body.error.code, 'VALIDATION_ERROR'); } });
test('dedupe distingue lotes', async () => { const selected = await prisma.lot.create({ data: lotData(65000) }); await chat('10 toneladas para Brasil FOB', 1); await chat('10 toneladas para Brasil FOB', selected.id); assert.equal(await prisma.order.count(), 2); });
test('dedupe conserva una misma orden por lote', async () => { await chat('10 toneladas para Brasil FOB', 1); const second = await chat('10 toneladas para Brasil FOB', 1); assert.equal(await prisma.order.count(), 1); assert.equal(second.body.order.lotId, 1); });
test('fund descuenta el lote seleccionado', async () => { const selected = await prisma.lot.create({ data: lotData(65000) }); const created = await chat('10 toneladas para Brasil FOB', selected.id); const result = await request(`/api/orders/${created.body.order.id}/fund`, {}, '2'); assert.equal(result.response.status, 200); assert.equal((await prisma.lot.findUnique({ where: { id: selected.id } })).tonsAvailable, 990); assert.equal((await prisma.lot.findUnique({ where: { id: 1 } })).tonsAvailable, 1000); });
