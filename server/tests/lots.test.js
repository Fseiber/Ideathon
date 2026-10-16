process.env.STELLAR_MODE = 'mock';
process.env.DATABASE_URL = 'file:./test.db';
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';

const prisma = new PrismaClient();
let server;
let base;

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  return { response, body: await response.json() };
}

before(async () => {
  await prisma.party.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: 'Molino', role: 'MOLINO', stellarPublicKey: 'G' + '1'.repeat(55) } });
  await prisma.party.upsert({ where: { id: 2 }, update: {}, create: { id: 2, name: 'Buyer', role: 'COMPRADOR', stellarPublicKey: 'G' + '2'.repeat(55) } });
  server = createApp(prisma).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await prisma.orderEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.lot.create({ data: { id: 1, millId: 1, product: 'Arroz largo fino', variety: 'Largo fino', province: 'Corrientes', presentation: 'Bolsas 25 kg', brokenPct: 5, moisturePct: 13, pricePerTonCents: 60000, tonsTotal: 1000, tonsAvailable: 1000, mintTxHash: 'a'.repeat(64) } });
});

after(async () => { server.close(); await prisma.$disconnect(); });

test('publica un lote con atributos y precio', async () => {
  const result = await request('/api/lots', { method: 'POST', headers: { 'x-party-id': '1' }, body: JSON.stringify({ tons: 100, variety: 'Largo fino', brokenPct: 3, pricePerTonUsd: 650 }) });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.pricePerTonCents, 65000);
  assert.equal(result.body.variety, 'Largo fino');
  assert.equal(result.body.brokenPct, 3);
});

test('valida atributos comerciales', async () => {
  let result = await request('/api/lots', { method: 'POST', headers: { 'x-party-id': '1' }, body: JSON.stringify({ tons: 100, brokenPct: 120 }) });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  result = await request('/api/lots', { method: 'POST', headers: { 'x-party-id': '1' }, body: JSON.stringify({ tons: 100, variety: '' }) });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.error.code, 'VALIDATION_ERROR');
});

test('chat conserva la cotización de referencia con el precio del lote', async () => {
  const result = await request('/api/chat', { method: 'POST', headers: { 'x-party-id': '2' }, body: JSON.stringify({ messages: [{ role: 'user', content: '20 tn a Asunción CFR' }] }) });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.order.totalCents, 1350000);
});

test('chat usa el precio comercial del lote', async () => {
  await prisma.lot.update({ where: { id: 1 }, data: { pricePerTonCents: 65000 } });
  const result = await request('/api/chat', { method: 'POST', headers: { 'x-party-id': '2' }, body: JSON.stringify({ messages: [{ role: 'user', content: '10 tn a Asunción FOB' }] }) });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.order.totalCents, 650000);
});

test('POST de órdenes explícito conserva el override de precio', async () => {
  const result = await request('/api/orders', { method: 'POST', headers: { 'x-party-id': '1' }, body: JSON.stringify({ millId: 1, buyerId: 2, destination: 'Asunción', tons: 20, pricePerTonUsd: 700, incoterm: 'FOB' }) });
  assert.equal(result.response.status, 201);
  assert.equal(result.body.pricePerTonCents, 70000);
  assert.equal(result.body.totalCents, 1400000);
});
