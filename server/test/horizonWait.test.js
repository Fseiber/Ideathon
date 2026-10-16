import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForTx } from '../src/utils/horizonWait.js';

function fakeServer(responses) {
  let calls = 0;
  return {
    transactions: () => ({ transaction: () => ({ call: async () => {
      const response = responses[Math.min(calls++, responses.length - 1)];
      if (response instanceof Error) throw response;
      return response;
    } }) }),
  };
}

const notFound = () => Object.assign(new Error('not found'), { response: { status: 404 } });
const unavailable = () => Object.assign(new Error('unavailable'), { response: { status: 503 } });

test('reintenta 404 y resuelve cuando la transacción aparece', async () => {
  const delays = [];
  const result = await waitForTx(fakeServer([notFound(), notFound(), { successful: true }]), 'a'.repeat(64), { sleep: async ms => delays.push(ms) });
  assert.equal(result.successful, true);
  assert.deepEqual(delays, [1000, 2000]);
});

test('agota los intentos con TX_NOT_FOUND', async () => {
  await assert.rejects(waitForTx(fakeServer([notFound()]), 'b'.repeat(64), { attempts: 3, sleep: async () => {} }), error => error.code === 'TX_NOT_FOUND' && error.message.includes('b'.repeat(64)));
});

test('una transacción fallida no se reintenta', async () => {
  let sleeps = 0;
  await assert.rejects(waitForTx(fakeServer([{ successful: false, result_xdr: 'xdr-fallida' }]), 'c'.repeat(64), { sleep: async () => { sleeps += 1; } }), error => error.message === 'TX_FAILED: xdr-fallida');
  assert.equal(sleeps, 0);
});

test('reintenta errores 503', async () => {
  const delays = [];
  const result = await waitForTx(fakeServer([unavailable(), { successful: true }]), 'd'.repeat(64), { sleep: async ms => delays.push(ms) });
  assert.equal(result.successful, true);
  assert.deepEqual(delays, [1000]);
});

test('limita el backoff a maxMs', async () => {
  const delays = [];
  await assert.rejects(waitForTx(fakeServer([notFound()]), 'e'.repeat(64), { attempts: 6, baseMs: 1000, maxMs: 5000, sleep: async ms => delays.push(ms) }), /TX_NOT_FOUND/);
  assert.deepEqual(delays, [1000, 2000, 4000, 5000, 5000]);
});
