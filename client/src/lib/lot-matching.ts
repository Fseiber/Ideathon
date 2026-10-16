// Reglas de compatibilidad lote ↔ solicitud COMEX (F2).
// Espejo de matchLot en server/src/services/comexMatching.js: el backend es la fuente de verdad
// del Matching; este módulo sirve para previsualizar en el formulario. Ambos se prueban contra
// server/tests/fixtures/comex-matching-cases.json.

export type MatchResult = "compatible" | "condicional" | "incompatible";

export interface MatchRequestInput {
  variety: string;
  tons: number;
  maxBrokenPct?: number | null;
  maxMoisturePct?: number | null;
  presentation?: string | null;
}

export interface MatchLotInput {
  id: number;
  variety: string;
  tonsAvailable: number;
  tonsReserved?: number | undefined;
  brokenPct: number | null;
  moisturePct: number | null;
  presentation: string;
}

export interface LotMatch {
  lotId: number;
  result: MatchResult;
  matches: string[];
  conditions: string[];
  failures: string[];
  partialContribution: boolean;
  contributionNote: string | null;
}

export const MATCHING_DISCLAIMER = "La propuesta no reserva stock. Cobertura comercial estimada; no implica mezcla física de lotes ni compatibilidad documental. Precios publicados sin flete ni derechos.";

export function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Disponibilidad comercial = stock del flujo Stellar menos reservas COMEX confirmadas.
export const availableTons = (lot: Pick<MatchLotInput, "tonsAvailable" | "tonsReserved">) => lot.tonsAvailable - (lot.tonsReserved ?? 0);

const isSet = <T,>(value: T | null | undefined): value is T => value !== null && value !== undefined;

export function matchLot(request: MatchRequestInput, lot: MatchLotInput): LotMatch {
  const matches: string[] = [];
  const conditions: string[] = [];
  const failures: string[] = [];

  if (normalizeText(lot.variety) !== normalizeText(request.variety)) failures.push(`Variedad distinta: se requiere ${request.variety} y el lote es ${lot.variety}`);
  else matches.push(`Variedad ${lot.variety}`);

  // El volumen no decide el resultado técnico: un lote chico puede aportar parcialmente a una propuesta multilote.
  const available = availableTons(lot);
  let contributionNote: string | null = null;
  if (available <= 0) failures.push("Sin disponibilidad");
  else if (available < request.tons) contributionNote = `Aporte parcial: ${available} de ${request.tons} tn`;
  else matches.push(`Disponibilidad suficiente: ${available} tn`);

  const quality: [string, number | null | undefined, number | null][] = [["Quebrado", request.maxBrokenPct, lot.brokenPct], ["Humedad", request.maxMoisturePct, lot.moisturePct]];
  for (const [label, max, value] of quality) {
    if (!isSet(max)) continue;
    if (!isSet(value)) conditions.push(`${label} no declarado (máx. ${max}%)`);
    else if (value > max) failures.push(`${label} ${value}% supera el máximo de ${max}%`);
    else matches.push(`${label} ${value}% (máx. ${max}%)`);
  }

  if (isSet(request.presentation) && normalizeText(request.presentation)) {
    if (normalizeText(lot.presentation) !== normalizeText(request.presentation)) conditions.push(`Presentación distinta: se solicita ${request.presentation} y el lote está en ${lot.presentation}`);
    else matches.push(`Presentación ${lot.presentation}`);
  }

  const result: MatchResult = failures.length ? "incompatible" : conditions.length ? "condicional" : "compatible";
  return { lotId: lot.id, result, matches, conditions, failures, partialContribution: contributionNote !== null, contributionNote };
}

export const RESULT_LABEL: Record<MatchResult, string> = { compatible: "Compatible", condicional: "Requiere confirmación", incompatible: "Incompatible" };
export const RESULT_TONO: Record<MatchResult, "success" | "warning" | "danger"> = { compatible: "success", condicional: "warning", incompatible: "danger" };
