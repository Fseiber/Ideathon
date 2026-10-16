process.env.STELLAR_MODE = 'mock';
process.env.DATABASE_URL = 'file:./test.db';
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { hashPassword, sha256, verifyPassword } from '../src/utils/password.js';

const prisma = new PrismaClient();
let server;
let base;
const PASSWORD = 'clave-de-prueba-123';

async function request(path, { token, ...options } = {}) {
  const headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) };
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

async function createUser(email, roles, extra = {}) {
  return prisma.user.create({ data: { email: email.toLowerCase(), name: email.split('@')[0], roles, passwordHash: await hashPassword(PASSWORD), ...extra } });
}

async function login(email, password = PASSWORD) {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

async function tokenFor(email, roles) {
  await createUser(email, roles);
  return (await login(email)).body.token;
}

before(async () => {
  await prisma.party.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: 'Molino', role: 'MOLINO', stellarPublicKey: 'G' + '1'.repeat(55) } });
  await prisma.party.upsert({ where: { id: 2 }, update: {}, create: { id: 2, name: 'Buyer', role: 'COMPRADOR', stellarPublicKey: 'G' + '2'.repeat(55) } });
  server = createApp(prisma).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await prisma.auditEvent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.lot.updateMany({ data: { supplierCompanyId: null } });
  await prisma.companyContact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.lot.deleteMany({ where: { id: { gt: 1 } } });
  await prisma.lot.upsert({ where: { id: 1 }, update: { millId: 1, tonsTotal: 1000, tonsAvailable: 1000 }, create: { id: 1, millId: 1, tonsTotal: 1000, tonsAvailable: 1000, mintTxHash: 'a'.repeat(64) } });
});

after(async () => {
  await prisma.auditEvent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.lot.updateMany({ data: { supplierCompanyId: null } });
  await prisma.company.deleteMany();
  server.close();
  await prisma.$disconnect();
});

test('1. hashPassword/verifyPassword con salt aleatorio', async () => {
  const a = await hashPassword(PASSWORD);
  const b = await hashPassword(PASSWORD);
  assert.match(a, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(PASSWORD, a), true);
  assert.equal(await verifyPassword('otra-clave-123', a), false);
  assert.equal(await verifyPassword(PASSWORD, 'basura'), false);
});

test('2. login devuelve token y la DB guarda sólo sha256(token)', async () => {
  await createUser('Admin@Test.com', 'ADMIN');
  const r = await login('  ADMIN@test.com ');
  assert.equal(r.response.status, 200);
  assert.match(r.body.token, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(r.body.user).sort(), ['email', 'id', 'name', 'roles']);
  assert.deepEqual(r.body.user.roles, ['ADMIN']);
  const sessions = await prisma.session.findMany();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].tokenHash, sha256(r.body.token));
  assert.notEqual(sessions[0].tokenHash, r.body.token);
  const ttlH = (sessions[0].expiresAt - sessions[0].createdAt) / 3600000;
  assert.ok(ttlH > 11.9 && ttlH <= 12.01);
});

test('3. login fallido: mismo 401 y mensaje para pw errónea y email inexistente', async () => {
  await createUser('comex@test.com', 'COMEX');
  const wrong = await login('comex@test.com', 'incorrecta-123');
  const missing = await login('nadie@test.com');
  assert.equal(wrong.response.status, 401);
  assert.equal(missing.response.status, 401);
  assert.equal(wrong.body.error.message, 'Credenciales inválidas');
  assert.deepEqual(wrong.body, missing.body);
});

test('4. /me exige sesión válida, no expirada y usuario activo', async () => {
  let r = await request('/api/auth/me');
  assert.equal(r.response.status, 401);
  assert.equal(r.body.error.code, 'UNAUTHENTICATED');
  const token = await tokenFor('docs@test.com', 'DOCS');
  r = await request('/api/auth/me', { token });
  assert.equal(r.response.status, 200);
  assert.equal(r.body.email, 'docs@test.com');
  await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
  r = await request('/api/auth/me', { token });
  assert.equal(r.response.status, 401);
  const fresh = (await login('docs@test.com')).body.token;
  await prisma.user.update({ where: { email: 'docs@test.com' }, data: { active: false } });
  r = await request('/api/auth/me', { token: fresh });
  assert.equal(r.response.status, 401);
  assert.equal(r.body.error.code, 'UNAUTHENTICATED');
});

test('5. DOCS puede leer empresas pero no crearlas', async () => {
  const token = await tokenFor('docs@test.com', 'DOCS');
  let r = await request('/api/comex/companies', { token });
  assert.equal(r.response.status, 200);
  r = await request('/api/comex/companies', { token, method: 'POST', body: JSON.stringify({ name: 'Empresa X', country: 'Argentina', roles: ['COMPRADOR'] }) });
  assert.equal(r.response.status, 403);
  assert.equal(r.body.error.code, 'FORBIDDEN');
  r = await request('/api/comex/users', { token });
  assert.equal(r.response.status, 403);
});

test('6. COMEX crea empresa con auditoría y valida roles', async () => {
  const token = await tokenFor('comex@test.com', 'COMEX');
  let r = await request('/api/comex/companies', { token, method: 'POST', body: JSON.stringify({ name: 'Comprador Asunción SA', country: 'Paraguay', roles: ['COMPRADOR'] }) });
  assert.equal(r.response.status, 201);
  assert.deepEqual(r.body.roles, ['COMPRADOR']);
  const events = await prisma.auditEvent.findMany();
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'company.create');
  assert.equal(events[0].entityId, String(r.body.id));
  assert.equal(JSON.parse(events[0].data).name, 'Comprador Asunción SA');
  for (const roles of [['PIRATA'], [], undefined]) {
    const bad = await request('/api/comex/companies', { token, method: 'POST', body: JSON.stringify({ name: 'Otra', country: 'Paraguay', roles }) });
    assert.equal(bad.response.status, 400);
    assert.equal(bad.body.error.code, 'VALIDATION_ERROR');
  }
  r = await request(`/api/comex/companies/${r.body.id}/contacts`, { token, method: 'POST', body: JSON.stringify({ name: 'Ana', email: 'no-es-email' }) });
  assert.equal(r.response.status, 400);
  r = await request('/api/comex/companies?role=COMPRADOR&q=Asunci', { token });
  assert.equal(r.body.length, 1);
  r = await request('/api/comex/companies?role=MOLINO', { token });
  assert.equal(r.body.length, 0);
});

test('7. vincular lote exige empresa MOLINO y /api/lots expone supplier', async () => {
  const token = await tokenFor('comex@test.com', 'COMEX');
  const buyer = await request('/api/comex/companies', { token, method: 'POST', body: JSON.stringify({ name: 'Sólo Comprador', country: 'Paraguay', roles: ['COMPRADOR'] }) });
  const mill = await request('/api/comex/companies', { token, method: 'POST', body: JSON.stringify({ name: 'Molino Norte', country: 'Argentina', roles: ['MOLINO'] }) });
  let r = await request('/api/comex/lots/1/supplier', { token, method: 'PATCH', body: JSON.stringify({ supplierCompanyId: buyer.body.id }) });
  assert.equal(r.response.status, 400);
  r = await request('/api/comex/lots/1/supplier', { token, method: 'PATCH', body: JSON.stringify({ supplierCompanyId: mill.body.id }) });
  assert.equal(r.response.status, 200);
  r = await request('/api/lots', { headers: { 'x-party-id': '2' } });
  const lot = r.body.find(l => l.id === 1);
  assert.deepEqual(lot.supplier, { id: mill.body.id, name: 'Molino Norte' });
});

test('8. logout invalida el token', async () => {
  const token = await tokenFor('comex@test.com', 'COMEX');
  let r = await request('/api/auth/logout', { token, method: 'POST' });
  assert.equal(r.response.status, 204);
  r = await request('/api/auth/me', { token });
  assert.equal(r.response.status, 401);
});

test('ADMIN gestiona usuarios; PATCH sólo campos editables', async () => {
  const token = await tokenFor('admin@test.com', 'ADMIN');
  let r = await request('/api/comex/users', { token, method: 'POST', body: JSON.stringify({ email: 'Nuevo@Test.com', name: 'Nuevo', password: 'corta', roles: ['DOCS'] }) });
  assert.equal(r.response.status, 400);
  r = await request('/api/comex/users', { token, method: 'POST', body: JSON.stringify({ email: 'Nuevo@Test.com', name: 'Nuevo', password: 'suficientemente-larga', roles: ['DOCS'] }) });
  assert.equal(r.response.status, 201);
  assert.equal(r.body.email, 'nuevo@test.com');
  assert.equal(r.body.passwordHash, undefined);
  r = await request('/api/comex/users', { token });
  assert.equal(r.body.length, 2);
  const company = await request('/api/comex/companies', { token, method: 'POST', body: JSON.stringify({ name: 'Empresa', country: 'Argentina', roles: 'MOLINO' }) });
  r = await request(`/api/comex/companies/${company.body.id}`, { token, method: 'PATCH', body: JSON.stringify({ id: 99 }) });
  assert.equal(r.response.status, 400);
  r = await request(`/api/comex/companies/${company.body.id}`, { token, method: 'PATCH', body: JSON.stringify({ province: 'Chaco' }) });
  assert.equal(r.response.status, 200);
  assert.equal(r.body.province, 'Chaco');
  assert.equal(r.body.name, 'Empresa');
});
