import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from '../src/agent/index.js';

const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-secret';
  process.env.GEMINI_MODEL = 'gemini-test';
});

after(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalModel;
});

function fakeFetch(result, seen = {}) {
  return async (url, options) => {
    seen.url = url;
    seen.options = options;
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }) };
  };
}

test('devuelve una respuesta válida', async () => {
  const result = await runAgent([{ role: 'user', content: '20 toneladas para Asunción CFR' }], { fetch: fakeFetch({ reply: 'Listo', intent: { tons: 20, destination: 'Asunción', incoterm: 'CFR' } }) });
  assert.deepEqual(result, { reply: 'Listo', intent: { tons: 20, destination: 'Asunción', incoterm: 'CFR' } });
});

test('normaliza el Incoterm', async () => {
  const result = await runAgent([{ role: 'user', content: 'pedido' }], { fetch: fakeFetch({ reply: 'Ok', intent: { tons: 20, destination: 'Asunción', incoterm: 'cfr' } }) });
  assert.equal(result.intent?.incoterm, 'CFR');
});

test('descarta toneladas no enteras', async () => {
  const result = await runAgent([{ role: 'user', content: 'pedido' }], { fetch: fakeFetch({ reply: 'Faltan datos', intent: { tons: 20.5, destination: 'Asunción', incoterm: 'CFR' } }) });
  assert.equal(result.intent, null);
  assert.equal(result.reply, 'Faltan datos');
});

test('conserva intent null', async () => {
  const result = await runAgent([{ role: 'user', content: 'Hola' }], { fetch: fakeFetch({ reply: '¿Cuántas toneladas necesitás?', intent: null }) });
  assert.deepEqual(result, { reply: '¿Cuántas toneladas necesitás?', intent: null });
});

test('lanza ante HTTP 500', async () => {
  await assert.rejects(runAgent([], { fetch: async () => ({ ok: false, status: 500 }) }), /GEMINI_HTTP_500/);
});

test('lanza ante texto no JSON', async () => {
  await assert.rejects(runAgent([], { fetch: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'no-json' }] } }] }) }) }), SyntaxError);
});

test('lanza si falta la configuración', async () => {
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(runAgent([]), /GEMINI_NOT_CONFIGURED/);
});

test('reemplaza respuestas con precios', async () => {
  const result = await runAgent([], { fetch: fakeFetch({ reply: 'El total es USD 13500', intent: null }) });
  assert.equal(result.reply, 'Perfecto, te preparo la cotización con los valores del sistema.');
});

test('envía la clave solo en el header', async () => {
  const seen = {};
  await runAgent([], { fetch: fakeFetch({ reply: 'Ok', intent: null }, seen) });
  assert.equal(seen.options.headers['x-goog-api-key'], 'test-secret');
  assert.equal(seen.url.includes('test-secret'), false);
});

test('mapea assistant al rol model', async () => {
  const seen = {};
  await runAgent([{ role: 'assistant', content: '¿Destino?' }, { role: 'user', content: 'Asunción' }], { fetch: fakeFetch({ reply: 'Ok', intent: null }, seen) });
  const body = JSON.parse(seen.options.body);
  assert.deepEqual(body.contents.map(content => content.role), ['model', 'user']);
});
