import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { explainMatch, validateExplanation } from '../src/agent/explainMatch.js';
import { explainOrFallback, validateExplainBody } from '../src/routes/matching.js';

const saved = { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL, mode: process.env.AGENT_MODE };

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-secret';
  process.env.GEMINI_MODEL = 'gemini-test';
  process.env.AGENT_MODE = 'gemini';
});

after(() => {
  for (const [name, value] of [['GEMINI_API_KEY', saved.key], ['GEMINI_MODEL', saved.model], ['AGENT_MODE', saved.mode]]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const input = validateExplainBody({
  solicitud: { variedad: 'Largo fino', tipoArroz: 'Blanco', volumenTn: 40, quebradoMaxPct: 5, humedadMaxPct: 14, paisDestino: 'Paraguay', incoterm: 'FOB' },
  resultados: [
    { loteId: 'LOTE-A', empresa: 'Molino Norte', resultado: 'compatible', coincidencias: ['Variedad Largo fino'], diferencias: [], incumplimientos: [] },
    { loteId: 'LOTE-B', empresa: 'Molino Sur', resultado: 'incompatible', coincidencias: [], diferencias: [], incumplimientos: ['Quebrado 7% supera el máximo de 5%'] },
  ],
});

function fakeFetch(explanation) {
  return async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ explanation }) }] } }] }) });
}

test('devuelve la explicación de Gemini cuando es válida', async () => {
  const text = 'LOTE-A cumple todos los requisitos; conviene pedir cotización. LOTE-B se descarta por quebrado.';
  assert.equal(await explainMatch(input, { fetch: fakeFetch(text) }), text);
});

test('rechaza explicaciones con lotes inventados o precios', () => {
  assert.throws(() => validateExplanation('Recomendamos LOTE-Z, que cumple con todo lo pedido.', input), /GEMINI_UNKNOWN_LOT/);
  assert.throws(() => validateExplanation('LOTE-A cumple y cuesta USD 600 por tonelada.', input), /GEMINI_PRICE_IN_EXPLANATION/);
});

test('cae a la plantilla si Gemini falla o está en modo stub', async () => {
  assert.deepEqual(await explainOrFallback(input, { explain: async () => { throw new Error('GEMINI_HTTP_500'); } }), { explanation: null, agent: 'stub' });
  process.env.AGENT_MODE = 'stub';
  assert.deepEqual(await explainOrFallback(input, { explain: async () => 'no debería usarse' }), { explanation: null, agent: 'stub' });
});

test('valida el cuerpo de la solicitud', () => {
  assert.throws(() => validateExplainBody({ solicitud: {}, resultados: [] }), /resultados/);
  assert.throws(() => validateExplainBody({ solicitud: input.solicitud, resultados: [{ ...input.resultados[0], resultado: 'excelente' }] }), /resultado inválido/);
});
