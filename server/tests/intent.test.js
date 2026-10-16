process.env.STELLAR_MODE = 'mock';
process.env.DATABASE_URL = 'file:./test.db';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMessage, resolveIntent } from '../src/services/intentParser.js';

const user = content => ({ role: 'user', content });
const assistant = content => ({ role: 'assistant', content });

test('extrae una intención simple', () => assert.deepEqual(resolveIntent([user('50 toneladas para Brasil FOB')]).intent, { tons: 50, destination: 'Brasil', incoterm: 'FOB' }));
test('ignora calidad y toma el destino correcto', () => assert.deepEqual(resolveIntent([user('Quiero 50 toneladas de arroz largo fino, máximo 5% de quebrado, para Brasil, FOB.')]).intent, { tons: 50, destination: 'Brasil', incoterm: 'FOB' }));
test('una solicitud nueva prevalece sobre una cotización anterior', () => assert.deepEqual(resolveIntent([user('Quiero 20 toneladas para Asunción CFR'), assistant('¡Perfecto!\n\nCotización: 20 tn...'), user('50 toneladas para Brasil FOB')]).intent, { tons: 50, destination: 'Brasil', incoterm: 'FOB' }));
test('faltantes no crean intención', () => { const result = resolveIntent([user('20 toneladas para Asunción')]); assert.equal(result.intent, null); assert.deepEqual(result.missing, ['Incoterm (FOB o CFR)']); });
test('continúa solo una pregunta de faltante', () => assert.deepEqual(resolveIntent([user('20 toneladas para Asunción'), assistant('Para cotizar necesito: Incoterm (FOB o CFR).'), user('CFR')]).intent, { tons: 20, destination: 'Asunción', incoterm: 'CFR' }));
test('no hereda desde una cotización terminada', () => assert.equal(resolveIntent([user('20 toneladas para Asunción CFR'), assistant('Cotización: ...'), user('CFR')]).intent, null));
test('rechaza continuación ambigua y permite que el último dato reemplace el anterior', () => { assert.equal(resolveIntent([user('20 toneladas para Asunción'), assistant('Para cotizar necesito: Incoterm (FOB o CFR).'), user('FOB o CFR')]).intent, null); assert.deepEqual(resolveIntent([user('20 toneladas para Asunción'), assistant('Para cotizar necesito: Incoterm (FOB o CFR).'), user('50 toneladas FOB')]).intent, { tons: 50, destination: 'Asunción', incoterm: 'FOB' }); });
test('no mezcla una pregunta sobre USDC con una cotización', () => { const parsed = parseMessage('con USDC? Quiero 20 toneladas para Asunción'); assert.equal(parsed.destination, 'Asunción'); assert.equal(resolveIntent([user('¿Puedo pagar con USDC?')]).intent, null); });
test('detecta ambigüedad en toneladas e Incoterm', () => { assert.equal(resolveIntent([user('Quiero 20 o 50 toneladas para Brasil FOB')]).ambiguous, 'toneladas'); assert.equal(resolveIntent([user('50 toneladas para Brasil FOB o CFR')]).ambiguous, 'Incoterm'); });
