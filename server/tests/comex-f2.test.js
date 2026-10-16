process.env.STELLAR_MODE = 'mock';
process.env.DATABASE_URL = 'file:./test.db';
import test, { before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/utils/password.js';
import { matchLot, proposeAllocation } from '../src/services/comexMatching.js';

const CASES = JSON.parse(readFileSync(new URL('./fixtures/comex-matching-cases.json', import.meta.url), 'utf8'));
const lot = (id, overrides = {}) => ({ id, variety: 'Largo fino', tonsAvailable: 100, brokenPct: 3, moisturePct: 13, presentation: 'Bolsas 25 kg', pricePerTonCents: 60000, supplier: null, ...overrides });
const req = (overrides = {}) => ({ variety: 'Largo fino', tons: 50, maxBrokenPct: null, maxMoisturePct: null, presentation: null, requiredBy: null, certifications: null, ...overrides });

describe('matchLot', () => {
  for (const c of CASES) {
    test(`fixture compartido: ${c.name}`, () => {
      const r = matchLot(c.request, c.lot);
      assert.equal(r.lotId, c.lot.id);
      assert.equal(r.result, c.expected.result);
      assert.deepEqual(r.conditions, c.expected.conditions);
      assert.deepEqual(r.failures, c.expected.failures);
      assert.equal(r.partialContribution, c.expected.partialContribution);
      assert.equal(r.contributionNote, c.expected.contributionNote);
    });
  }
  test('1-5. casos obligatorios', () => {
    assert.equal(matchLot(req(), lot(1, { variety: 'Doble Carolina' })).result, 'incompatible');
    assert.equal(matchLot(req({ maxBrokenPct: 5 }), lot(1, { brokenPct: 6 })).result, 'incompatible');
    assert.equal(matchLot(req({ maxBrokenPct: 5 }), lot(1, { brokenPct: null })).result, 'condicional');
    // F3A: el volumen insuficiente ya no es condición; es aporte parcial.
    const partial = matchLot(req({ tons: 200 }), lot(1));
    assert.equal(partial.result, 'compatible');
    assert.equal(partial.partialContribution, true);
    assert.equal(matchLot(req({ maxBrokenPct: 5, maxMoisturePct: 14, presentation: 'bolsas 25 KG' }), lot(1)).result, 'compatible');
  });
});

describe('proposeAllocation', () => {
  test('6. 50 tn con A 30 tn a USD 600 y B 40 tn a USD 650 → A 30 + B 20, US$ 31.000', () => {
    const p = proposeAllocation(req({ tons: 50 }), [lot(2, { tonsAvailable: 40, pricePerTonCents: 65000 }), lot(1, { tonsAvailable: 30, pricePerTonCents: 60000 })]);
    assert.deepEqual(p.lines.map(l => [l.lotId, l.tons, l.subtotalCents]), [[1, 30, 1800000], [2, 20, 1300000]]);
    assert.equal(p.totalCents, 3100000);
    assert.equal(p.weightedAvgPriceCents, 62000);
    assert.equal(p.coveredTons, 50);
    assert.equal(p.missingTons, 0);
    assert.equal(p.complete, true);
    assert.equal(p.pricingComplete, true);
    assert.match(p.disclaimer, /no reserva stock/);
    assert.match(p.totalScope, /sin flete, derechos/);
  });

  test('7. 100 tn con 70 disponibles → missingTons 30', () => {
    const p = proposeAllocation(req({ tons: 100 }), [lot(1, { tonsAvailable: 40 }), lot(2, { tonsAvailable: 30 })]);
    assert.equal(p.coveredTons, 70);
    assert.equal(p.missingTons, 30);
    assert.equal(p.complete, false);
  });

  test('8. sin candidatos → cobertura cero', () => {
    const p = proposeAllocation(req(), [lot(1, { variety: 'Doble Carolina' }), lot(2, { tonsAvailable: 0 })]);
    assert.deepEqual(p.lines, []);
    assert.equal(p.coveredTons, 0);
    assert.equal(p.missingTons, 50);
    assert.equal(p.totalCents, 0);
    assert.equal(p.weightedAvgPriceCents, 0);
  });

  test('9. nunca duplica lotId ni excede disponibilidad', () => {
    const lots = [lot(1, { tonsAvailable: 10 }), lot(1, { tonsAvailable: 10 }), lot(2, { tonsAvailable: 7 }), lot(3, { tonsAvailable: 5 }), lot(4, { variety: 'Doble Carolina', tonsAvailable: 500 })];
    const p = proposeAllocation(req({ tons: 1000 }), lots);
    const ids = p.lines.map(l => l.lotId);
    assert.equal(new Set(ids).size, ids.length);
    for (const line of p.lines) assert.ok(line.tons <= lots.find(l => l.id === line.lotId).tonsAvailable);
    assert.ok(!ids.includes(4));
    assert.equal(p.coveredTons, 22);
  });

  test('10. condicional a USD 550 vs compatible a USD 600 → primero el compatible', () => {
    const p = proposeAllocation(req({ tons: 50, maxBrokenPct: 5 }), [lot(1, { brokenPct: null, pricePerTonCents: 55000 }), lot(2, { pricePerTonCents: 60000 })]);
    assert.deepEqual(p.lines.map(l => [l.lotId, l.result]), [[2, 'compatible']]);
  });

  test('11. precio <= 0 queda pendiente y no altera las otras líneas', () => {
    const p = proposeAllocation(req({ tons: 50 }), [lot(1, { tonsAvailable: 30, pricePerTonCents: 60000 }), lot(2, { tonsAvailable: 30, pricePerTonCents: 0 })]);
    assert.deepEqual(p.lines.map(l => [l.lotId, l.tons, l.subtotalCents, l.pricePending]), [[1, 30, 1800000, false], [2, 20, null, true]]);
    assert.equal(p.totalCents, 1800000);
    assert.equal(p.weightedAvgPriceCents, 60000);
    assert.equal(p.pricingComplete, false);
    assert.equal(p.complete, true);
  });

  test('16b. dentro del grupo un precio pendiente nunca se elige por ser el más barato', () => {
    const p = proposeAllocation(req({ tons: 40 }), [lot(1, { tonsAvailable: 50, pricePerTonCents: 0 }), lot(2, { tonsAvailable: 50, pricePerTonCents: 60000 })]);
    assert.deepEqual(p.lines.map(l => [l.lotId, l.tons]), [[2, 40]]);
    assert.equal(p.pricingComplete, true);
  });

  test('desempate: disponibilidad descendente e ID ascendente; resultado determinista', () => {
    const lots = [lot(3, { tonsAvailable: 20 }), lot(2, { tonsAvailable: 20 }), lot(1, { tonsAvailable: 10 })];
    const a = proposeAllocation(req({ tons: 45 }), lots);
    const b = proposeAllocation(req({ tons: 45 }), [...lots].reverse());
    assert.deepEqual(a.lines.map(l => [l.lotId, l.tons]), [[2, 20], [3, 20], [1, 5]]);
    assert.deepEqual(a, b);
  });

  test('requiredBy y certifications figuran en notEvaluated', () => {
    assert.deepEqual(proposeAllocation(req({ requiredBy: new Date(), certifications: 'Halal' }), [lot(1)]).notEvaluated, ['requiredBy', 'certifications']);
    assert.deepEqual(proposeAllocation(req(), [lot(1)]).notEvaluated, []);
  });
});

const prisma = new PrismaClient();
let server;
let base;
const PASSWORD = 'clave-de-prueba-123';
let buyerId;
let millCompanyId;

async function request(path, { token, ...options } = {}) {
  const headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

async function tokenFor(email, roles) {
  await prisma.user.create({ data: { email, name: email.split('@')[0], roles, passwordHash: await hashPassword(PASSWORD) } });
  return (await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password: PASSWORD }) })).body.token;
}

const validBody = (overrides = {}) => ({ buyerCompanyId: buyerId, variety: 'Largo fino', tons: 50, destination: 'Asunción, PY', incoterm: 'CFR', ...overrides });

describe('API /api/comex/requests', () => {
  before(async () => {
    await prisma.party.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: 'Molino', role: 'MOLINO', stellarPublicKey: 'G' + '1'.repeat(55) } });
    await prisma.party.upsert({ where: { id: 2 }, update: {}, create: { id: 2, name: 'Buyer', role: 'COMPRADOR', stellarPublicKey: 'G' + '2'.repeat(55) } });
    server = createApp(prisma).listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(async () => {
    await prisma.lotReservation.deleteMany();
    await prisma.purchaseRequest.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.orderEvent.deleteMany();
    await prisma.order.deleteMany();
    await prisma.lot.deleteMany({ where: { id: { gt: 1 } } });
    await prisma.lot.updateMany({ data: { supplierCompanyId: null } });
    await prisma.companyContact.deleteMany();
    await prisma.company.deleteMany();
    buyerId = (await prisma.company.create({ data: { name: 'Comprador Asunción SA', country: 'Paraguay', roles: 'COMPRADOR' } })).id;
    millCompanyId = (await prisma.company.create({ data: { name: 'Molino Norte', country: 'Argentina', roles: 'MOLINO' } })).id;
    await prisma.lot.upsert({ where: { id: 1 }, update: { millId: 1, variety: 'Largo fino', brokenPct: 5, moisturePct: 13, presentation: 'Bolsas 25 kg', tonsTotal: 1000, tonsAvailable: 30, pricePerTonCents: 60000, supplierCompanyId: millCompanyId }, create: { id: 1, millId: 1, tonsTotal: 1000, tonsAvailable: 30, mintTxHash: 'a'.repeat(64), supplierCompanyId: millCompanyId } });
    await prisma.lot.create({ data: { id: 2, millId: 1, variety: 'Largo fino', brokenPct: 4, moisturePct: 13, presentation: 'Bolsas 25 kg', tonsTotal: 40, tonsAvailable: 40, pricePerTonCents: 65000, mintTxHash: 'b'.repeat(64) } });
    await prisma.lot.create({ data: { id: 3, millId: 1, variety: 'Doble Carolina', tonsTotal: 500, tonsAvailable: 500, pricePerTonCents: 40000, mintTxHash: 'c'.repeat(64) } });
  });

  after(async () => {
    await prisma.lotReservation.deleteMany();
    await prisma.purchaseRequest.deleteMany();
    await prisma.auditEvent.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.lot.deleteMany({ where: { id: { gt: 1 } } });
    await prisma.lot.updateMany({ data: { supplierCompanyId: null, tonsAvailable: 1000 } });
    await prisma.company.deleteMany();
    server.close();
    await prisma.$disconnect();
  });

  test('12. valida comprador, toneladas, incoterm, porcentajes y fecha', async () => {
    const token = await tokenFor('comex@test.com', 'COMEX');
    const post = body => request('/api/comex/requests', { token, method: 'POST', body: JSON.stringify(body) });
    for (const body of [validBody({ buyerCompanyId: millCompanyId }), validBody({ tons: 0 }), validBody({ tons: 100001 }), validBody({ tons: 1.5 }), validBody({ incoterm: 'EXW' }), validBody({ maxBrokenPct: 120 }), validBody({ variety: 'X' }), validBody({ destination: 'A' }), validBody({ requiredBy: '2001-01-01' }), validBody({ requiredBy: 'mañana' }), validBody({ status: 'CERRADA' })]) {
      const r = await post(body);
      assert.equal(r.response.status, 400, JSON.stringify(body));
      assert.equal(r.body.error.code, 'VALIDATION_ERROR');
    }
    assert.equal((await post(validBody({ buyerCompanyId: 99999 }))).response.status, 404);
    const ok = await post(validBody({ incoterm: 'fob', maxBrokenPct: 5, requiredBy: '2099-12-31' }));
    assert.equal(ok.response.status, 201);
    assert.equal(ok.body.incoterm, 'FOB');
    assert.equal(ok.body.status, 'ABIERTA');
    assert.equal(ok.body.buyer.name, 'Comprador Asunción SA');
  });

  test('13. DOCS lee pero no crea solicitudes', async () => {
    const comex = await tokenFor('comex@test.com', 'COMEX');
    const created = await request('/api/comex/requests', { token: comex, method: 'POST', body: JSON.stringify(validBody()) });
    const docs = await tokenFor('docs@test.com', 'DOCS');
    assert.equal((await request('/api/comex/requests', { token: docs })).response.status, 200);
    assert.equal((await request(`/api/comex/requests/${created.body.id}/matching`, { token: docs })).response.status, 200);
    let r = await request('/api/comex/requests', { token: docs, method: 'POST', body: JSON.stringify(validBody()) });
    assert.equal(r.response.status, 403);
    r = await request(`/api/comex/requests/${created.body.id}/status`, { token: docs, method: 'POST', body: JSON.stringify({ status: 'EN_ANALISIS' }) });
    assert.equal(r.response.status, 403);
  });

  test('14. transiciones inválidas → 409; edición sólo en ABIERTA/EN_ANALISIS', async () => {
    const token = await tokenFor('comex@test.com', 'COMEX');
    const { body: created } = await request('/api/comex/requests', { token, method: 'POST', body: JSON.stringify(validBody()) });
    const move = status => request(`/api/comex/requests/${created.id}/status`, { token, method: 'POST', body: JSON.stringify({ status }) });
    assert.equal((await move('COTIZADA')).response.status, 409);
    assert.equal((await move('CERRADA')).response.status, 409);
    let r = await move('EN_ANALISIS');
    assert.equal(r.response.status, 200);
    assert.deepEqual(r.body.allowedTransitions, ['ABIERTA', 'CANCELADA']);
    assert.equal((await move('EN_ANALISIS')).response.status, 409);
    assert.equal((await move('ABIERTA')).response.status, 200);
    assert.equal((await move('CANCELADA')).response.status, 200);
    r = await move('ABIERTA');
    assert.equal(r.response.status, 409);
    assert.equal(r.body.error.code, 'INVALID_TRANSITION');
    r = await request(`/api/comex/requests/${created.id}`, { token, method: 'PATCH', body: JSON.stringify({ tons: 10 }) });
    assert.equal(r.response.status, 409);
  });

  test('15. cada modificación genera auditoría', async () => {
    const token = await tokenFor('comex@test.com', 'COMEX');
    const { body: created } = await request('/api/comex/requests', { token, method: 'POST', body: JSON.stringify(validBody()) });
    let r = await request(`/api/comex/requests/${created.id}`, { token, method: 'PATCH', body: JSON.stringify({ tons: 60, notes: 'Urgente' }) });
    assert.equal(r.response.status, 200);
    assert.equal(r.body.tons, 60);
    await request(`/api/comex/requests/${created.id}/status`, { token, method: 'POST', body: JSON.stringify({ status: 'EN_ANALISIS' }) });
    const events = await prisma.auditEvent.findMany({ where: { entity: 'PurchaseRequest' }, orderBy: { id: 'asc' } });
    assert.deepEqual(events.map(e => e.action), ['request.create', 'request.update', 'request.status']);
    assert.deepEqual(JSON.parse(events[1].data), { tons: { from: 50, to: 60 }, notes: { from: null, to: 'Urgente' } });
    assert.deepEqual(JSON.parse(events[2].data), { from: 'ABIERTA', to: 'EN_ANALISIS' });
    assert.ok(events.every(e => e.entityId === String(created.id)));
  });

  test('filtros de listado por estado, comprador y texto', async () => {
    const token = await tokenFor('comex@test.com', 'COMEX');
    const { body: a } = await request('/api/comex/requests', { token, method: 'POST', body: JSON.stringify(validBody({ destination: 'Asunción, PY' })) });
    await request('/api/comex/requests', { token, method: 'POST', body: JSON.stringify(validBody({ destination: 'Santiago, CL' })) });
    await request(`/api/comex/requests/${a.id}/status`, { token, method: 'POST', body: JSON.stringify({ status: 'EN_ANALISIS' }) });
    assert.equal((await request('/api/comex/requests', { token })).body.length, 2);
    assert.deepEqual((await request('/api/comex/requests?status=EN_ANALISIS', { token })).body.map(r => r.id), [a.id]);
    assert.equal((await request('/api/comex/requests?q=Santiago', { token })).body.length, 1);
    assert.equal((await request(`/api/comex/requests?buyerCompanyId=${buyerId}`, { token })).body.length, 2);
    assert.equal((await request('/api/comex/requests?status=PIRATA', { token })).response.status, 400);
  });

  test('16. matching API usa los lotes persistidos y no modifica stock', async () => {
    const token = await tokenFor('comex@test.com', 'COMEX');
    const { body: created } = await request('/api/comex/requests', { token, method: 'POST', body: JSON.stringify(validBody({ certifications: 'Halal' })) });
    const before = await prisma.lot.findMany({ orderBy: { id: 'asc' }, select: { id: true, tonsAvailable: true } });
    const r = await request(`/api/comex/requests/${created.id}/matching`, { token });
    assert.equal(r.response.status, 200);
    assert.deepEqual(r.body.results.map(x => [x.lotId, x.result, x.partialContribution]), [[1, 'compatible', true], [2, 'compatible', true], [3, 'incompatible', false]]);
    const p = r.body.proposal;
    assert.deepEqual(p.lines.map(l => [l.lotId, l.tons, l.subtotalCents, l.supplier?.name ?? null]), [[1, 30, 1800000, 'Molino Norte'], [2, 20, 1300000, null]]);
    assert.equal(p.totalCents, 3100000);
    assert.equal(p.complete, true);
    assert.deepEqual(p.notEvaluated, ['certifications']);
    assert.deepEqual(await prisma.lot.findMany({ orderBy: { id: 'asc' }, select: { id: true, tonsAvailable: true } }), before);
    assert.equal(await prisma.order.count(), 0);
  });
});
