process.env.STELLAR_MODE = 'mock';
process.env.DATABASE_URL = 'file:./test.db';
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/utils/password.js';
import { commercialAvailable, expireDueReservations } from '../src/services/reservationService.js';

const prisma = new PrismaClient();
let server;
let base;
let comex;
let docs;
let buyerId;
let comexUserId;
const PASSWORD = 'clave-de-prueba-123';

async function request(path, { token, party, ...options } = {}) {
  const headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(party ? { 'x-party-id': String(party) } : {}) };
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}
const post = (path, body, opts) => request(path, { ...opts, method: 'POST', body: JSON.stringify(body ?? {}) });

async function login(email, roles) {
  const user = await prisma.user.create({ data: { email, name: email.split('@')[0], roles, passwordHash: await hashPassword(PASSWORD) } });
  return { id: user.id, token: (await post('/api/auth/login', { email, password: PASSWORD })).body.token };
}

const lotRow = id => prisma.lot.findUnique({ where: { id } });
const newRequest = async (overrides = {}) => (await post('/api/comex/requests', { buyerCompanyId: buyerId, variety: 'Largo fino', tons: 50, destination: 'Asunción, PY', incoterm: 'CFR', ...overrides }, { token: comex })).body;
const reserve = (requestId, lotId, tons, extra = {}) => post(`/api/comex/requests/${requestId}/reservations`, { lotId, tons, ...extra }, { token: comex });
const confirm = id => post(`/api/comex/reservations/${id}/confirm`, { channel: 'whatsapp', contact: 'Juan (molino)', reference: 'msg-123' }, { token: comex });
const release = (id, reason = 'Comprador desistió') => post(`/api/comex/reservations/${id}/release`, { reason }, { token: comex });
const order = (tons, lotId) => post('/api/orders', { millId: 1, buyerId: 2, destination: 'Asunción, PY', tons, pricePerTonUsd: 600, incoterm: 'FOB', ...(lotId ? { lotId } : {}) }, { party: 1 });
const fund = id => post(`/api/orders/${id}/fund`, {}, { party: 2 });

async function cleanup() {
  await prisma.lotReservation.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.lot.deleteMany({ where: { id: { gt: 1 } } });
  await prisma.lot.updateMany({ data: { supplierCompanyId: null, tonsReserved: 0 } });
  await prisma.companyContact.deleteMany();
  await prisma.company.deleteMany();
}

before(async () => {
  await prisma.party.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: 'Molino', role: 'MOLINO', stellarPublicKey: 'G' + '1'.repeat(55) } });
  await prisma.party.upsert({ where: { id: 2 }, update: {}, create: { id: 2, name: 'Buyer', role: 'COMPRADOR', stellarPublicKey: 'G' + '2'.repeat(55) } });
  server = createApp(prisma).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await cleanup();
  await prisma.lot.upsert({ where: { id: 1 }, update: { millId: 1, variety: 'Largo fino', brokenPct: 5, moisturePct: 13, presentation: 'Bolsas 25 kg', tonsTotal: 50, tonsAvailable: 50, tonsReserved: 0, pricePerTonCents: 60000 }, create: { id: 1, millId: 1, tonsTotal: 50, tonsAvailable: 50, mintTxHash: 'a'.repeat(64) } });
  buyerId = (await prisma.company.create({ data: { name: 'Comprador Asunción SA', country: 'Paraguay', roles: 'COMPRADOR' } })).id;
  ({ token: comex, id: comexUserId } = await login('comex@test.com', 'COMEX'));
  ({ token: docs } = await login('docs@test.com', 'DOCS'));
});

after(async () => {
  await cleanup();
  await prisma.lot.update({ where: { id: 1 }, data: { tonsTotal: 1000, tonsAvailable: 1000 } });
  server.close();
  await prisma.$disconnect();
});

test('1. una reserva SOLICITADA no cambia tonsReserved ni tonsAvailable', async () => {
  const req = await newRequest();
  const r = await reserve(req.id, 1, 30);
  assert.equal(r.response.status, 201);
  assert.equal(r.body.status, 'SOLICITADA');
  const hours = (new Date(r.body.expiresAt) - Date.now()) / 3600000;
  assert.ok(hours > 71.9 && hours <= 72);
  const lot = await lotRow(1);
  assert.equal(lot.tonsReserved, 0);
  assert.equal(lot.tonsAvailable, 50);
});

test('2. confirmar 30 tn en lote de 50 → tonsReserved 30, disponible 20 y auditoría', async () => {
  const req = await newRequest();
  const { body: created } = await reserve(req.id, 1, 30);
  const r = await confirm(created.id);
  assert.equal(r.response.status, 200);
  assert.equal(r.body.status, 'CONFIRMADA');
  assert.equal(r.body.confirmationChannel, 'WHATSAPP');
  assert.equal(r.body.confirmedBy.id, comexUserId);
  const lot = await lotRow(1);
  assert.equal(lot.tonsReserved, 30);
  assert.equal(commercialAvailable(lot), 20);
  const lots = await request('/api/lots', { party: 2 });
  assert.equal(lots.body.find(l => l.id === 1).commercialAvailable, 20);
  assert.equal(lots.body.find(l => l.id === 1).tonsReserved, 30);
  const actions = (await prisma.auditEvent.findMany({ where: { entity: 'LotReservation' }, orderBy: { id: 'asc' } })).map(e => e.action);
  assert.deepEqual(actions, ['reservation.create', 'reservation.confirm']);
});

test('3. dos confirmaciones simultáneas de 30 sobre 50 libres → una OK, otra 409', async () => {
  const req = await newRequest();
  const a = (await reserve(req.id, 1, 30)).body;
  const b = (await reserve(req.id, 1, 30)).body;
  const results = await Promise.all([confirm(a.id), confirm(b.id)]);
  assert.deepEqual(results.map(r => r.response.status).sort(), [200, 409]);
  assert.ok(['INSUFFICIENT_STOCK', 'RETRY_LATER'].includes(results.find(r => r.response.status === 409).body.error.code));
  assert.equal((await lotRow(1)).tonsReserved, 30);
  const statuses = (await prisma.lotReservation.findMany({ orderBy: { id: 'asc' } })).map(r => r.status).sort();
  assert.deepEqual(statuses, ['CONFIRMADA', 'SOLICITADA']);
});

test('4. confirmar más que lo disponible → 409 INSUFFICIENT_STOCK y sigue SOLICITADA', async () => {
  const req = await newRequest();
  const first = (await reserve(req.id, 1, 40)).body;
  const second = (await reserve(req.id, 1, 20)).body;
  await confirm(first.id);
  const r = await confirm(second.id);
  assert.equal(r.response.status, 409);
  assert.equal(r.body.error.code, 'INSUFFICIENT_STOCK');
  assert.equal((await prisma.lotReservation.findUnique({ where: { id: second.id } })).status, 'SOLICITADA');
  assert.equal((await lotRow(1)).tonsReserved, 40);
  assert.equal((await reserve(req.id, 1, 11)).response.status, 409);
});

test('5. el vencimiento libera una sola vez, aun en llamadas repetidas o paralelas', async () => {
  const req = await newRequest();
  const a = (await reserve(req.id, 1, 30)).body;
  await confirm(a.id);
  await prisma.lotReservation.update({ where: { id: a.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal(await expireDueReservations(prisma), 1);
  assert.equal(await expireDueReservations(prisma), 0);
  let row = await prisma.lotReservation.findUnique({ where: { id: a.id } });
  assert.equal(row.status, 'VENCIDA');
  assert.equal(row.releaseReason, 'Vencimiento');
  assert.equal((await lotRow(1)).tonsReserved, 0);

  const b = (await reserve(req.id, 1, 20)).body;
  await confirm(b.id);
  await prisma.lotReservation.update({ where: { id: b.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await Promise.all([expireDueReservations(prisma), expireDueReservations(prisma), request('/api/lots', { party: 2 })]);
  row = await prisma.lotReservation.findUnique({ where: { id: b.id } });
  assert.equal(row.status, 'VENCIDA');
  assert.equal((await lotRow(1)).tonsReserved, 0);
  const expireAudits = await prisma.auditEvent.count({ where: { action: 'reservation.expire' } });
  assert.equal(expireAudits, 2);
  assert.equal((await confirm(b.id)).response.status, 409);
});

test('6. liberar CONFIRMADA baja tonsReserved; liberar de nuevo → 409; nunca negativo', async () => {
  const req = await newRequest();
  const a = (await reserve(req.id, 1, 30)).body;
  await confirm(a.id);
  let r = await release(a.id);
  assert.equal(r.response.status, 200);
  assert.equal(r.body.status, 'LIBERADA');
  assert.equal(r.body.releaseReason, 'Comprador desistió');
  assert.equal((await lotRow(1)).tonsReserved, 0);
  r = await release(a.id);
  assert.equal(r.response.status, 409);
  assert.equal((await lotRow(1)).tonsReserved, 0);
  const s = (await reserve(req.id, 1, 10)).body;
  assert.equal((await release(s.id)).response.status, 200);
  assert.equal((await lotRow(1)).tonsReserved, 0);
  assert.equal((await post(`/api/comex/reservations/${s.id}/release`, { reason: '' }, { token: comex })).response.status, 400);
});

test('7. flujo Stellar respeta las reservas confirmadas', async () => {
  const thirty = (await order(30, 1)).body;
  const req = await newRequest();
  const res = (await reserve(req.id, 1, 30)).body;
  await confirm(res.id);
  let r = await fund(thirty.id);
  assert.equal(r.response.status, 409);
  assert.equal(r.body.error.code, 'INSUFFICIENT_STOCK');
  assert.equal((await prisma.order.findUnique({ where: { id: thirty.id } })).status, 'COTIZADA');
  assert.equal((await order(30, 1)).response.status, 409);
  const twenty = (await order(20, 1)).body;
  r = await fund(twenty.id);
  assert.equal(r.response.status, 200);
  assert.equal(r.body.status, 'FONDEADA');
  let lot = await lotRow(1);
  assert.equal(lot.tonsAvailable, 30);
  assert.equal(lot.tonsReserved, 30);
  r = await order(30);
  assert.equal(r.response.status, 409);
  await prisma.lot.create({ data: { id: 2, millId: 1, variety: 'Largo fino', tonsTotal: 100, tonsAvailable: 100, mintTxHash: 'b'.repeat(64) } });
  r = await order(30);
  assert.equal(r.response.status, 201);
  assert.equal(r.body.lotId, 2);
  lot = await lotRow(1);
  assert.equal(lot.tonsAvailable, 30);
});

test('8. Matching: aporte parcial compatible y reservas de otra solicitud reducen la cobertura', async () => {
  await prisma.lot.create({ data: { id: 2, millId: 1, variety: 'Largo ancho', brokenPct: 4, moisturePct: 13, tonsTotal: 30, tonsAvailable: 30, pricePerTonCents: 60000, mintTxHash: 'b'.repeat(64) } });
  await prisma.lot.create({ data: { id: 3, millId: 1, variety: 'Largo ancho', brokenPct: 4, moisturePct: 13, tonsTotal: 40, tonsAvailable: 40, pricePerTonCents: 65000, mintTxHash: 'c'.repeat(64) } });
  const mine = await newRequest({ variety: 'Largo ancho', tons: 50 });
  let m = (await request(`/api/comex/requests/${mine.id}/matching`, { token: comex })).body;
  assert.deepEqual(m.results.filter(r => r.lotId > 1).map(r => [r.lotId, r.result, r.partialContribution, r.contributionNote]), [[2, 'compatible', true, 'Aporte parcial: 30 de 50 tn'], [3, 'compatible', true, 'Aporte parcial: 40 de 50 tn']]);
  assert.equal(m.proposal.coveredTons, 50);
  assert.equal(m.proposal.summary, 'Cobertura completa: 50/50 tn con 2 proveedores · Pendiente de confirmación de reservas');

  const other = await newRequest({ variety: 'Largo ancho', tons: 30 });
  const theirs = (await reserve(other.id, 3, 30)).body;
  await confirm(theirs.id);
  m = (await request(`/api/comex/requests/${mine.id}/matching`, { token: comex })).body;
  assert.deepEqual(m.proposal.lines.map(l => [l.lotId, l.tons]), [[2, 30], [3, 10]]);
  assert.equal(m.proposal.coveredTons, 40);
  assert.equal(m.proposal.summary, 'Cobertura parcial: 40/50 tn');

  // Las reservas confirmadas de la propia solicitud no le restan cobertura.
  m = (await request(`/api/comex/requests/${other.id}/matching`, { token: comex })).body;
  assert.equal(m.proposal.coveredTons, 30);
  assert.match(m.proposal.summary, /Reservas confirmadas$/);
});

test('9. from-proposal crea una SOLICITADA por línea y es idempotente', async () => {
  await prisma.lot.create({ data: { id: 2, millId: 1, variety: 'Largo fino', tonsTotal: 30, tonsAvailable: 30, pricePerTonCents: 55000, mintTxHash: 'b'.repeat(64) } });
  const req = await newRequest({ tons: 60 });
  const first = await post(`/api/comex/requests/${req.id}/reservations/from-proposal`, {}, { token: comex });
  assert.equal(first.response.status, 201);
  assert.deepEqual(first.body.reservations.map(r => [r.lotId, r.tons, r.status]), [[2, 30, 'SOLICITADA'], [1, 30, 'SOLICITADA']]);
  const second = await post(`/api/comex/requests/${req.id}/reservations/from-proposal`, {}, { token: comex });
  assert.equal(second.response.status, 200);
  assert.deepEqual(second.body.created, []);
  assert.deepEqual(second.body.reservations.map(r => r.id), first.body.reservations.map(r => r.id));
  assert.equal(await prisma.lotReservation.count(), 2);
  assert.equal((await lotRow(1)).tonsReserved, 0);
  const list = await request(`/api/comex/requests/${req.id}/reservations`, { token: comex });
  assert.equal(list.body.confirmedTons, 0);
  assert.equal(list.body.requestTons, 60);
});

test('10. DOCS lee reservas pero no puede crear, confirmar ni liberar', async () => {
  const req = await newRequest();
  const res = (await reserve(req.id, 1, 10)).body;
  assert.equal((await request(`/api/comex/requests/${req.id}/reservations`, { token: docs })).response.status, 200);
  assert.equal((await post(`/api/comex/reservations/${res.id}/confirm`, { channel: 'EMAIL', contact: 'x@y.z' }, { token: docs })).response.status, 403);
  assert.equal((await post(`/api/comex/reservations/${res.id}/release`, { reason: 'test' }, { token: docs })).response.status, 403);
  assert.equal((await post(`/api/comex/requests/${req.id}/reservations`, { lotId: 1, tons: 5 }, { token: docs })).response.status, 403);
});

test('validaciones: canal, contacto, vencimiento y estado de la solicitud', async () => {
  const req = await newRequest();
  for (const extra of [{ expiresAt: '2001-01-01T00:00:00Z' }, { expiresAt: new Date(Date.now() + 31 * 86400000).toISOString() }, { expiresAt: 'mañana' }]) {
    assert.equal((await reserve(req.id, 1, 10, extra)).response.status, 400);
  }
  assert.equal((await reserve(req.id, 1, 0)).response.status, 400);
  assert.equal((await reserve(req.id, 999, 1)).response.status, 404);
  const res = (await reserve(req.id, 1, 10, { expiresAt: new Date(Date.now() + 86400000).toISOString() })).body;
  assert.equal((await post(`/api/comex/reservations/${res.id}/confirm`, { channel: 'FAX', contact: 'x' }, { token: comex })).response.status, 400);
  assert.equal((await post(`/api/comex/reservations/${res.id}/confirm`, { channel: 'EMAIL', contact: '' }, { token: comex })).response.status, 400);
  await post(`/api/comex/requests/${req.id}/status`, { status: 'CANCELADA' }, { token: comex });
  assert.equal((await reserve(req.id, 1, 10)).response.status, 409);
});
