import test from 'node:test';
import assert from 'node:assert/strict';
import { quote } from '../src/services/quote.js';
test('quote CFR calcula todos los importes', () => assert.deepEqual(quote({ tons: 20, pricePerTonCents: 60000, incoterm: 'CFR', freightCents: 150000, exportDutyPct: 5 }), { subtotalCents: 1200000, freightCents: 150000, totalCents: 1350000, exportDutyCents: 60000, advanceCents: 405000, balanceCents: 945000, millNetCents: 1140000 }));
test('quote FOB no suma flete', () => { const q = quote({ tons: 20, pricePerTonCents: 60000, incoterm: 'FOB', freightCents: 150000, exportDutyPct: 5 }); assert.equal(q.freightCents, 0); assert.equal(q.totalCents, 1200000); assert.equal(q.advanceCents, 360000); assert.equal(q.balanceCents, 840000); });
