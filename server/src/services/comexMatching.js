// Matching COMEX (F2): funciones puras, sin acceso a DB ni a Stellar.
// Las reglas de matchLot deben coincidir con client/src/lib/lot-matching.ts
// (ambos se prueban contra server/tests/fixtures/comex-matching-cases.json).

export const MATCHING_DISCLAIMER = 'La propuesta no reserva stock. Cobertura comercial estimada; no implica mezcla física de lotes ni compatibilidad documental. Precios publicados sin flete ni derechos.';

export function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const isSet = value => value !== null && value !== undefined;

export function matchLot(request, lot) {
  const matches = [];
  const conditions = [];
  const failures = [];

  if (normalizeText(lot.variety) !== normalizeText(request.variety)) failures.push(`Variedad distinta: se requiere ${request.variety} y el lote es ${lot.variety}`);
  else matches.push(`Variedad ${lot.variety}`);

  if (lot.tonsAvailable <= 0) failures.push('Sin disponibilidad');
  else if (lot.tonsAvailable < request.tons) conditions.push(`Disponibilidad parcial: ${lot.tonsAvailable} de ${request.tons} tn`);
  else matches.push(`Disponibilidad suficiente: ${lot.tonsAvailable} tn`);

  for (const [label, max, value] of [['Quebrado', request.maxBrokenPct, lot.brokenPct], ['Humedad', request.maxMoisturePct, lot.moisturePct]]) {
    if (!isSet(max)) continue;
    if (!isSet(value)) conditions.push(`${label} no declarado (máx. ${max}%)`);
    else if (value > max) failures.push(`${label} ${value}% supera el máximo de ${max}%`);
    else matches.push(`${label} ${value}% (máx. ${max}%)`);
  }

  if (isSet(request.presentation) && normalizeText(request.presentation)) {
    if (normalizeText(lot.presentation) !== normalizeText(request.presentation)) conditions.push(`Presentación distinta: se solicita ${request.presentation} y el lote está en ${lot.presentation}`);
    else matches.push(`Presentación ${lot.presentation}`);
  }

  const result = failures.length ? 'incompatible' : conditions.length ? 'condicional' : 'compatible';
  return { lotId: lot.id, result, matches, conditions, failures };
}

const RESULT_ORDER = { compatible: 0, condicional: 1, incompatible: 2 };
const hasPrice = lot => Number.isInteger(lot.pricePerTonCents) && lot.pricePerTonCents > 0;

// Orden de prioridad: compatibles antes que condicionales; dentro de cada grupo los precios
// pendientes van al final, luego precio ascendente, disponibilidad descendente e ID ascendente.
function compareCandidates(a, b) {
  return RESULT_ORDER[a.match.result] - RESULT_ORDER[b.match.result]
    || Number(!hasPrice(a.lot)) - Number(!hasPrice(b.lot))
    || (hasPrice(a.lot) && hasPrice(b.lot) ? a.lot.pricePerTonCents - b.lot.pricePerTonCents : 0)
    || b.lot.tonsAvailable - a.lot.tonsAvailable
    || a.lot.id - b.lot.id;
}

export function rankMatches(request, lots) {
  return uniqueLots(lots).map(lot => ({ lot, match: matchLot(request, lot) })).sort(compareCandidates).map(c => c.match);
}

function uniqueLots(lots) {
  const seen = new Set();
  return lots.filter(lot => !seen.has(lot.id) && seen.add(lot.id));
}

export function notEvaluatedFields(request) {
  const fields = [];
  if (isSet(request.requiredBy)) fields.push('requiredBy');
  if (isSet(request.certifications) && String(request.certifications).trim()) fields.push('certifications');
  return fields;
}

export function proposeAllocation(request, lots) {
  const candidates = uniqueLots(lots)
    .map(lot => ({ lot, match: matchLot(request, lot) }))
    .filter(c => c.match.result !== 'incompatible')
    .sort(compareCandidates);

  const lines = [];
  let remaining = request.tons;
  for (const { lot, match } of candidates) {
    if (remaining <= 0) break;
    const tons = Math.min(remaining, lot.tonsAvailable);
    if (tons <= 0) continue;
    const priced = hasPrice(lot);
    lines.push({
      lotId: lot.id,
      supplier: lot.supplier ? { id: lot.supplier.id, name: lot.supplier.name } : null,
      tons,
      pricePerTonCents: lot.pricePerTonCents,
      subtotalCents: priced ? tons * lot.pricePerTonCents : null,
      pricePending: !priced,
      result: match.result,
      conditions: match.conditions,
    });
    remaining -= tons;
  }

  const coveredTons = lines.reduce((sum, line) => sum + line.tons, 0);
  const pricedLines = lines.filter(line => !line.pricePending);
  const totalCents = pricedLines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const pricedTons = pricedLines.reduce((sum, line) => sum + line.tons, 0);
  return {
    lines,
    coveredTons,
    missingTons: request.tons - coveredTons,
    complete: coveredTons === request.tons,
    totalCents,
    totalScope: 'Subtotal conocido de mercadería, sin flete, derechos ni otros costos COMEX',
    weightedAvgPriceCents: pricedTons ? Math.round(totalCents / pricedTons) : 0,
    pricingComplete: pricedLines.length === lines.length,
    notEvaluated: notEvaluatedFields(request),
    disclaimer: MATCHING_DISCLAIMER,
  };
}
