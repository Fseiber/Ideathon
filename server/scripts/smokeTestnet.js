import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Horizon } from '@stellar/stellar-sdk';
import { waitForTx } from '../src/utils/horizonWait.js';
import { verifyDvpOps } from './dvpVerifier.js';
dotenv.config();

const args = process.argv.slice(2); const baseIndex = args.indexOf('--base'); const base = (baseIndex >= 0 ? args[baseIndex + 1] : 'http://localhost:4000').replace(/\/$/, ''); const allowMock = args.includes('--allow-mock');
const horizonUrl = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const configuredMode = process.env.STELLAR_MODE || '';
if ((!allowMock && configuredMode !== 'testnet') || (!allowMock && !horizonUrl.includes('testnet'))) { console.log(`❌ El server no está en testnet. Smoke requiere STELLAR_MODE=testnet y HORIZON_URL de testnet (modo=${configuredMode || 'no definido'}, horizon=${horizonUrl})`); process.exit(1); }
if (!horizonUrl.includes('testnet')) { console.log(`❌ HORIZON_URL no es testnet: ${horizonUrl}`); process.exit(1); }
const horizonServer = new Horizon.Server(horizonUrl);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message, expected, obtained) => { console.log(`❌ ${message}`); if (expected !== undefined) console.log(`   esperado: ${expected}\n   obtenido: ${obtained}`); throw new Error(message); };
async function api(pathname, options = {}) { try { const response = await fetch(`${base}${pathname}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } }); const body = await response.json(); return { response, body }; } catch { throw new Error(`No se pudo conectar a ${base}`); } }
async function horizon(pathname) { const response = await fetch(`${horizonUrl}${pathname}`); if (!response.ok) { const error = new Error(`Horizon respondió ${response.status} para ${pathname}`); error.status = response.status; throw error; } return response.json(); }
function balance(account, code, issuer) { const item = account.balances.find(entry => code === 'XLM' ? entry.asset_type === 'native' : entry.asset_code === code && (!issuer || entry.asset_issuer === issuer)); return Number(item?.balance || 0); }
function check(label, condition, expected, obtained) { if (!condition) fail(label, expected, obtained); console.log(`✅ ${label}`); }
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

try {
  const healthResult = await api('/api/health'); if (!healthResult.response.ok) fail('health no responde 200', 200, healthResult.response.status); const health = healthResult.body;
  if (health.stellarMode !== 'testnet' && !allowMock) { console.log('❌ El server no está en testnet'); process.exitCode = 1; } else {
    const horizonEnabled = health.stellarMode === 'testnet';
    const partiesResult = await api('/api/parties'); if (!partiesResult.response.ok) fail('no se pudieron leer las parties');
    const mill = partiesResult.body.find(party => party.role === 'MOLINO'); const buyer = partiesResult.body.find(party => party.role === 'COMPRADOR'); if (!mill || !buyer) fail('faltan parties MOLINO o COMPRADOR');
    let beforeMill; let beforeBuyer;
    if (horizonEnabled) {
      beforeMill = await horizon(`/accounts/${mill.stellarPublicKey}`); beforeBuyer = await horizon(`/accounts/${buyer.stellarPublicKey}`);
      const buyerUsdc = balance(beforeBuyer, 'USDC', health.issuerPublic); const millArroz = balance(beforeMill, 'ARROZ', health.issuerPublic);
      if (buyerUsdc < 20000) fail('saldo USDC insuficiente en comprador', '>= 20000', buyerUsdc); if (millArroz < 20) fail('saldo ARROZ insuficiente en molino', '>= 20', millArroz);
      console.log('✅ balances iniciales Horizon');
    }
    const orderInput = { millId: mill.id, buyerId: buyer.id, destination: 'Asunción, PY', tons: 20, pricePerTonUsd: 600, incoterm: 'CFR', freightUsd: 1500, exportDutyPct: 5 };
    const created = await api('/api/orders', { method: 'POST', headers: { 'x-party-id': String(mill.id) }, body: JSON.stringify(orderInput) }); if (created.response.status !== 201) fail('creación de orden', 201, created.response.status);
    const id = created.body.id; const steps = [created.body]; const funded = await api(`/api/orders/${id}/fund`, { method: 'POST', headers: { 'x-party-id': String(buyer.id) } }); if (funded.response.status !== 200) fail('fund', 200, funded.response.status); steps.push(funded.body);
    const dispatched = await api(`/api/orders/${id}/dispatch`, { method: 'POST', headers: { 'x-party-id': String(mill.id) } }); if (dispatched.response.status !== 200) fail('dispatch', 200, dispatched.response.status); steps.push(dispatched.body);
    const completed = await api(`/api/orders/${id}/confirm-delivery`, { method: 'POST', headers: { 'x-party-id': String(buyer.id) } }); if (completed.response.status !== 200) fail('confirm-delivery', 200, completed.response.status); steps.push(completed.body);
    const order = completed.body; console.log("Debug Order:", JSON.stringify(order, null, 2)); check('totales', order?.totalCents === 1350000 && order?.advanceCents === 405000 && order?.balanceCents === 945000, '1350000/405000/945000', `${order?.totalCents}/${order?.advanceCents}/${order?.balanceCents}`);
    check('estados', steps.map(step => step.status).join(',') === 'COTIZADA,FONDEADA,DESPACHADA,COMPLETADA', 'COTIZADA,FONDEADA,DESPACHADA,COMPLETADA', steps.map(step => step.status).join(','));
    const events = order?.events || []; const expectedEvents = ['FUND_ESCROW', 'LOCK_TOKENS', 'RELEASE_ADVANCE', 'DISPATCHED', 'SETTLE_DVP']; if (health.hederaMode !== 'off') expectedEvents.push('SEAL_HEDERA'); const types = (events || []).map(event => event.type); check('eventos', expectedEvents.every((type, index) => types[index] === type), expectedEvents.join(','), types.join(','));
     for (const event of events.filter(event => event.txHash)) { if (!/^[0-9a-f]{64}$/.test(event.txHash)) throw new Error(`Hash inválido en evento ${event.type}: ${event.txHash} — el paso probablemente corrió en modo mock o no propagó el hash`); check(`tx ${event.type}`, Boolean(event.explorerUrl), 'txHash hex + explorerUrl', event.txHash); }
      const settle = events.find(event => event.type === 'SETTLE_DVP');
      if (horizonEnabled) {
        const txHash = settle?.txHash;
        const hex64 = /^[0-9a-f]{64}$/.test(txHash || '');
        console.log(`[smoke] step=SETTLE_DVP txHash=${txHash} len=${txHash?.length || 0} hex64=${hex64} horizon=${horizonUrl} stellarMode=${health.stellarMode}`);
        if (!hex64) throw new Error(`Hash inválido en evento SETTLE_DVP: ${txHash} — el paso probablemente corrió en modo mock o no propagó el hash`);
        await waitForTx(horizonServer, txHash, { sleep });
        const operations = await horizonServer.operations().forTransaction(txHash).limit(10).call();
        verifyDvpOps(operations.records || [], { escrowPublicKey: health.escrowPublic, millPublicKey: mill.stellarPublicKey, buyerPublicKey: buyer.stellarPublicKey, assetIssuer: health.issuerPublic, usdcCode: 'USDC', arrozCode: 'ARROZ', balanceCents: order.balanceCents, tons: order.tons });
        check('operaciones DvP', true, '2 payments USDC + ARROZ', '2 payments USDC + ARROZ');
      const afterMill = await horizon(`/accounts/${mill.stellarPublicKey}`); const afterBuyer = await horizon(`/accounts/${buyer.stellarPublicKey}`); check('deltas Horizon', Math.abs(balance(afterMill, 'USDC', health.issuerPublic) - balance(beforeMill, 'USDC', health.issuerPublic) - 13500) < 0.000001 && Math.abs(balance(afterBuyer, 'ARROZ', health.issuerPublic) - balance(beforeBuyer, 'ARROZ', health.issuerPublic) - 20) < 0.000001, 'molino USDC +13500 y comprador ARROZ +20', 'ver delta');
    }
    if (health.hederaMode === 'testnet') { check('sello Hedera', order?.seal && /^[0-9a-f]{64}$/.test(order.seal.hash), 'seal válido', order?.seal); await sleep(8000); const verified = await api(`/api/orders/${id}/verify`, { headers: { 'x-party-id': String(buyer.id) } }); check('verify (valid:true)', verified.body.valid === true && verified.body.onChain === true, '{valid:true,onChain:true}', JSON.stringify(verified.body)); }
    if (health.hederaMode === 'mock') { const verified = await api(`/api/orders/${id}/verify`, { headers: { 'x-party-id': String(buyer.id) } }); check('verify (valid:true)', verified.body.valid === true && verified.body.onChain === null, '{valid:true,onChain:null}', JSON.stringify(verified.body)); }
    console.log('\nResumen'); console.log('| Paso | Enlace |'); console.log('|---|---|'); for (const event of events) if (event.txHash) console.log(`| ${event.type} | ${event.explorerUrl} |`); if (order?.seal) console.log(`| SEAL_HEDERA | ${order.seal.hashscanUrl} |`);
    const links = (events || []).map(event => ({ type: event.type, txHash: event.txHash, explorerUrl: event.explorerUrl })); if (order?.seal) links.push({ type: 'SEAL_HEDERA', txHash: null, explorerUrl: order.seal.hashscanUrl }); await fs.writeFile(path.join(root, 'demo-evidence.json'), JSON.stringify({ orderId: id, createdAt: new Date().toISOString(), links, seal: order?.seal || null }, null, 2)); console.log(`✅ Evidencia escrita en ${path.join(root, 'demo-evidence.json')}`);
    process.exitCode = 0;
  }
} catch (error) { if (error.message.startsWith('No se pudo conectar')) console.log(`❌ ${error.message}`); else if (error.message !== 'El server no está en testnet') console.log(`❌ ${error.message}`); process.exitCode = 1; }
process.exit(process.exitCode ?? 0);
