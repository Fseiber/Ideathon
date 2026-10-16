import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/utils/errors.js';
import { findTxByMemo, isAmbiguous, submitIdempotent } from '../src/utils/stellarIdempotency.js';
import { stepMemo } from '../src/services/orderService.js';

function horizonWith(records) {
  return { transactions: () => ({ forAccount: () => ({ order: () => ({ limit: () => ({ call: async () => ({ records }) }) }) }) }), submitTransaction: async () => ({ hash: 'submitted' }) };
}

test('reconcilia en el pre-chequeo sin construir ni enviar', async () => {
  let builds = 0; let submits = 0;
  const horizon = horizonWith([{ memo_type: 'text', memo: 'ARZ-order-F', source_account: 'Gsource', successful: true, hash: 'found' }]);
  horizon.submitTransaction = async () => { submits += 1; return { hash: 'never' }; };
  const result = await submitIdempotent({ horizon, sourcePublicKey: 'Gsource', memo: 'ARZ-order-F', buildAndSign: async () => { builds += 1; return {}; } });
  assert.deepEqual(result, { txHash: 'found', reconciled: true }); assert.equal(builds, 0); assert.equal(submits, 0);
});

test('envía una sola vez cuando no existe una transacción previa', async () => {
  const horizon = horizonWith([]); let builds = 0; let submits = 0;
  horizon.submitTransaction = async () => { submits += 1; return { hash: 'new-hash' }; };
  const result = await submitIdempotent({ horizon, sourcePublicKey: 'Gsource', memo: 'memo', buildAndSign: async () => { builds += 1; return {}; } });
  assert.deepEqual(result, { txHash: 'new-hash', reconciled: false }); assert.equal(builds, 1); assert.equal(submits, 1);
});

test('reconcilia un timeout sin reenviar', async () => {
  let lookup = 0; let submits = 0;
  const horizon = { transactions: () => ({ forAccount: () => ({ order: () => ({ limit: () => ({ call: async () => ({ records: lookup++ === 0 ? [] : [{ memo_type: 'text', memo: 'memo', source_account: 'Gsource', successful: true, hash: 'reconciled' }] }) }) }) }) }), submitTransaction: async () => { submits += 1; throw new Error('timeout'); } };
  const result = await submitIdempotent({ horizon, sourcePublicKey: 'Gsource', memo: 'memo', buildAndSign: async () => ({}), now: () => 0 });
  assert.deepEqual(result, { txHash: 'reconciled', reconciled: true }); assert.equal(submits, 1); assert.equal(lookup, 2);
});

test('un 504 sin confirmación termina como error seguro para reintentar', async () => {
  let time = 0; let submits = 0; let sleeps = 0;
  const error = Object.assign(new Error('gateway'), { response: { status: 504 } });
  const horizon = horizonWith([]); horizon.submitTransaction = async () => { submits += 1; throw error; };
  await assert.rejects(submitIdempotent({ horizon, sourcePublicKey: 'Gsource', memo: 'memo', buildAndSign: async () => ({}), now: () => time, sleep: async () => { sleeps += 1; time += 10000; } }), (reason) => reason instanceof AppError && reason.code === 'STELLAR_ERROR' && reason.message.includes('no se confirmó'));
  assert.equal(submits, 1); assert.ok(sleeps >= 1);
});

test('un error 400 es definitivo y no se sondea de nuevo', async () => {
  let lookups = 0;
  const horizon = horizonWith([]); const original = horizon.transactions;
  horizon.transactions = () => { lookups += 1; return original(); };
  horizon.submitTransaction = async () => { throw Object.assign(new Error('bad tx'), { response: { status: 400 } }); };
  await assert.rejects(submitIdempotent({ horizon, sourcePublicKey: 'Gsource', memo: 'memo', buildAndSign: async () => ({}) }), reason => reason instanceof AppError && reason.code === 'STELLAR_ERROR');
  assert.equal(lookups, 1);
});

test('findTxByMemo ignora fallidas y otra source', async () => {
  const result = await findTxByMemo({ horizon: horizonWith([{ memo_type: 'text', memo: 'memo', source_account: 'other', successful: true, hash: 'other' }, { memo_type: 'text', memo: 'memo', source_account: 'Gsource', successful: false, hash: 'failed' }]), sourcePublicKey: 'Gsource', memo: 'memo' });
  assert.equal(result, null);
  assert.equal(isAmbiguous(Object.assign(new Error(), { response: { status: 400 } })), false);
});

test('stepMemo genera memos cortos por paso', () => {
  for (const step of ['F', 'L', 'A', 'S']) { const memo = stepMemo('c884a4c1-6a72-4fd3', step); assert.equal(memo, `ARZ-c884a4c1-${step}`); assert.ok(Buffer.byteLength(memo) <= 28); }
});
