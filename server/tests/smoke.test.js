process.env.STELLAR_MODE = 'mock';
process.env.HEDERA_MODE = 'mock';
process.env.DATABASE_URL = 'file:./test.db';
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
const prisma = new PrismaClient(); let server; let base;
before(async () => { await prisma.party.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: 'Molino', role: 'MOLINO', stellarPublicKey: 'G' + '1'.repeat(55) } }); await prisma.party.upsert({ where: { id: 2 }, update: {}, create: { id: 2, name: 'Buyer', role: 'COMPRADOR', stellarPublicKey: 'G' + '2'.repeat(55) } }); server = createApp(prisma).listen(0); base = `http://127.0.0.1:${server.address().port}`; });
beforeEach(async () => { await prisma.orderEvent.deleteMany(); await prisma.order.deleteMany(); await prisma.lot.upsert({ where: { id: 1 }, update: { millId: 1, tonsTotal: 1000, tonsAvailable: 1000, mintTxHash: 'a'.repeat(64) }, create: { id: 1, millId: 1, tonsTotal: 1000, tonsAvailable: 1000, mintTxHash: 'a'.repeat(64) } }); });
after(async () => { if (fs.existsSync('demo-evidence.json')) fs.unlinkSync('demo-evidence.json'); server.close(); await prisma.$disconnect(); });
function run(...args) { return spawnSync(process.execPath, ['scripts/smokeTestnet.js', ...args], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, STELLAR_MODE: 'mock', HEDERA_MODE: 'mock' } }); }
async function runWithExternalServer(...args) { const code = "import { PrismaClient } from '@prisma/client'; import { createApp } from './src/app.js'; const prisma = new PrismaClient(); createApp(prisma).listen(4011);"; const child = spawn(process.execPath, ['--input-type=module', '-e', code], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: 'file:./test.db', STELLAR_MODE: 'mock', HEDERA_MODE: 'mock' }, stdio: 'ignore' }); try { for (let attempt = 0; attempt < 30; attempt += 1) { try { const response = await fetch('http://127.0.0.1:4011/api/health'); if (response.ok) break; } catch { /* wait for server */ } await new Promise(resolve => setTimeout(resolve, 100)); } return run('--base', 'http://127.0.0.1:4011', ...args); } finally { child.kill(); } }
test('health expone modos y estado de DB sin secretos', async () => { const response = await fetch(`${base}/api/health`); const body = await response.json(); assert.equal(response.status, 200); assert.deepEqual(body, { ok: true, stellarMode: 'mock', hederaMode: 'mock', agentMode: 'stub', db: 'ok', issuerPublic: null, escrowPublic: null }); });
test('smoke mock permitido ejecuta el flujo y genera evidencia', async () => { const result = await runWithExternalServer('--allow-mock'); assert.equal(result.status, 0, result.stdout + result.stderr); assert.match(result.stdout, /✅ totales/); assert.match(result.stdout, /✅ estados/); assert.match(result.stdout, /✅ eventos/); assert.match(result.stdout, /✅ verify \(valid:true\)/); assert.equal(JSON.parse(fs.readFileSync('demo-evidence.json', 'utf8')).links.length >= 5, true); });
test('smoke sin allow-mock rechaza server mock', async () => { const result = await runWithExternalServer(); assert.equal(result.status, 1); assert.match(result.stdout, /❌ El server no está en testnet/); });
test('smoke reporta servidor inaccesible', async () => { const result = run('--base', 'http://127.0.0.1:1', '--allow-mock'); assert.equal(result.status, 1); assert.match(result.stdout, /No se pudo conectar/); });
