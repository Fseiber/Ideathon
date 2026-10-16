import test from 'node:test';
import assert from 'node:assert/strict';
import { amountToCents, verifyDvpOps } from '../scripts/dvpVerifier.js';

const escrow = 'GESCROW';
const mill = 'G....F4XX';
const buyer = 'G....JW62';
const issuer = 'GISSUER';
const expected = { escrowPublicKey: escrow, millPublicKey: mill, buyerPublicKey: buyer, assetIssuer: issuer, usdcCode: 'USDC', arrozCode: 'ARROZ', balanceCents: 945000, tons: 20 };
const records = () => [
  { id: 'usdc-op', type: 'payment', transaction_successful: true, from: escrow, to: mill, asset_type: 'credit_alphanum12', asset_code: 'USDC', asset_issuer: issuer, amount: '9450.0000000' },
  { id: 'arroz-op', type: 'payment', transaction_successful: true, from: escrow, to: buyer, asset_type: 'credit_alphanum12', asset_code: 'ARROZ', asset_issuer: issuer, amount: '20.0000000' },
];

test('verifica la transacción DvP real', () => assert.equal(verifyDvpOps(records(), expected), true));
test('rechaza USDC contra totalCents', () => assert.throws(() => verifyDvpOps(records(), { ...expected, balanceCents: 1350000 }), /campo=USDC\.amount esperado=1350000 recibido=945000/));
test('no depende de asset_type', () => assert.equal(verifyDvpOps(records().map(record => ({ ...record, asset_type: 'credit_alphanum12' })), expected), true));
test('convierte montos a centavos sin floats', () => { assert.equal(amountToCents('9450.0000000'), 945000); assert.throws(() => amountToCents('0.0000001'), /Monto con fracción de centavo/); });
test('rechaza una transacción sin operaciones', () => assert.throws(() => verifyDvpOps([], expected), /TX sin operaciones/));
