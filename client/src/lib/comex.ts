// ============================================================
// Calculadora COMEX — lógica de costos de exportación (demo)
// Clasificación de gastos coherente con Incoterms 2020.
// No usa tasas impositivas ni aranceles: los campos normativos
// quedan como "pendientes de verificación" y se cargan a mano.
// ============================================================

export type UnidadCosto = "por_tonelada" | "por_contenedor" | "por_operacion" | "por_dia" | "porcentaje";
export type TipoDato = "estimado" | "cotizado" | "verificado" | "pendiente";
export type ResponsablePago = "vendedor" | "comprador" | "segun_incoterm";

export interface ConceptoCosto {
  id: string;
  grupo: string;
  concepto: string;
  importe: number;
  moneda: "USD" | "ARS";
  unidad: UnidadCosto;
  cantidad: number;
  responsable: ResponsablePago;
  incluidoEnOtraTarifa: boolean;
  tipoDato: TipoDato;
  nota?: string;
}

export const GRUPOS_COSTO = [
  "A. Mercadería",
  "B. Logística nacional",
  "C. Gastos portuarios",
  "D. Aduana y certificaciones",
  "E. Transporte internacional",
  "F. Gastos comerciales y financieros",
] as const;

export function conceptosIniciales(): ConceptoCosto[] {
  return [
    // A. Mercadería
    { id: "c1", grupo: "A. Mercadería", concepto: "Costo del arroz (por tonelada)", importe: 520, moneda: "USD", unidad: "por_tonelada", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "cotizado" },
    { id: "c2", grupo: "A. Mercadería", concepto: "Procesamiento y clasificación", importe: 18, moneda: "USD", unidad: "por_tonelada", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    { id: "c3", grupo: "A. Mercadería", concepto: "Secado", importe: 8, moneda: "USD", unidad: "por_tonelada", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    { id: "c4", grupo: "A. Mercadería", concepto: "Envasado en bolsas de 25 kg", importe: 12, moneda: "USD", unidad: "por_tonelada", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "cotizado" },
    { id: "c5", grupo: "A. Mercadería", concepto: "Almacenamiento", importe: 3, moneda: "USD", unidad: "por_tonelada", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    { id: "c6", grupo: "A. Mercadería", concepto: "Controles de calidad", importe: 90, moneda: "USD", unidad: "por_operacion", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "cotizado" },
    // B. Logística nacional
    { id: "c7", grupo: "B. Logística nacional", concepto: "Transporte terrestre al puerto", importe: 28, moneda: "USD", unidad: "por_tonelada", cantidad: 1, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "cotizado" },
    { id: "c8", grupo: "B. Logística nacional", concepto: "Carga y descarga", importe: 6, moneda: "USD", unidad: "por_tonelada", cantidad: 1, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    { id: "c9", grupo: "B. Logística nacional", concepto: "Peajes", importe: 40, moneda: "USD", unidad: "por_contenedor", cantidad: 2, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    { id: "c10", grupo: "B. Logística nacional", concepto: "Seguro local", importe: 0.4, moneda: "USD", unidad: "porcentaje", cantidad: 1, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    { id: "c11", grupo: "B. Logística nacional", concepto: "Consolidación de contenedores", importe: 120, moneda: "USD", unidad: "por_contenedor", cantidad: 2, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    // C. Gastos portuarios
    { id: "c12", grupo: "C. Gastos portuarios", concepto: "THC / manipulación de terminal", importe: 260, moneda: "USD", unidad: "por_contenedor", cantidad: 2, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "cotizado" },
    { id: "c13", grupo: "C. Gastos portuarios", concepto: "Posicionamiento y pesaje", importe: 60, moneda: "USD", unidad: "por_contenedor", cantidad: 2, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    { id: "c14", grupo: "C. Gastos portuarios", concepto: "Documentación naviera", importe: 75, moneda: "USD", unidad: "por_operacion", cantidad: 1, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "cotizado" },
    { id: "c15", grupo: "C. Gastos portuarios", concepto: "Demurrage / detention (previsión)", importe: 0, moneda: "USD", unidad: "por_dia", cantidad: 0, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "pendiente", nota: "Solo si aplica; cargar días e importe según tarifa de la naviera" },
    // D. Aduana y certificaciones
    { id: "c16", grupo: "D. Aduana y certificaciones", concepto: "Honorarios de despachante", importe: 350, moneda: "USD", unidad: "por_operacion", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "cotizado" },
    { id: "c17", grupo: "D. Aduana y certificaciones", concepto: "Derechos de exportación", importe: 0, moneda: "USD", unidad: "porcentaje", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "pendiente", nota: "Pendiente de verificación normativa — cargar manualmente la alícuota vigente" },
    { id: "c18", grupo: "D. Aduana y certificaciones", concepto: "Certificado fitosanitario", importe: 120, moneda: "USD", unidad: "por_operacion", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    { id: "c19", grupo: "D. Aduana y certificaciones", concepto: "Certificado de origen", importe: 60, moneda: "USD", unidad: "por_operacion", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    // E. Transporte internacional
    { id: "c20", grupo: "E. Transporte internacional", concepto: "Flete internacional", importe: 1450, moneda: "USD", unidad: "por_contenedor", cantidad: 2, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "cotizado" },
    { id: "c21", grupo: "E. Transporte internacional", concepto: "Recargos navieros (BAF/CAF)", importe: 180, moneda: "USD", unidad: "por_contenedor", cantidad: 2, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    { id: "c22", grupo: "E. Transporte internacional", concepto: "Seguro internacional", importe: 0.5, moneda: "USD", unidad: "porcentaje", cantidad: 1, responsable: "segun_incoterm", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    // F. Gastos comerciales y financieros
    { id: "c23", grupo: "F. Gastos comerciales y financieros", concepto: "Comisión de intermediario / broker", importe: 1.5, moneda: "USD", unidad: "porcentaje", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    { id: "c24", grupo: "F. Gastos comerciales y financieros", concepto: "Comisiones bancarias y transferencia", importe: 150, moneda: "USD", unidad: "por_operacion", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "estimado" },
    { id: "c25", grupo: "F. Gastos comerciales y financieros", concepto: "Gastos por carta de crédito", importe: 0.8, moneda: "USD", unidad: "porcentaje", cantidad: 1, responsable: "vendedor", incluidoEnOtraTarifa: false, tipoDato: "pendiente", nota: "Confirmar con el banco interviniente" },
  ];
}

export interface ParametrosSimulacion {
  producto: string;
  cantidadTn: number;
  contenedores: number;
  incoterm: string;
  tipoCambioArs: number; // ARS por USD
  margenPct: number;
}

// Grupos que el vendedor asume según Incoterm 2020 (regla simplificada y editable)
const GRUPOS_VENDEDOR_POR_INCOTERM: Record<string, string[]> = {
  EXW: ["A. Mercadería"],
  FCA: ["A. Mercadería", "B. Logística nacional", "D. Aduana y certificaciones"],
  FAS: ["A. Mercadería", "B. Logística nacional", "D. Aduana y certificaciones"],
  FOB: ["A. Mercadería", "B. Logística nacional", "C. Gastos portuarios", "D. Aduana y certificaciones"],
  CFR: ["A. Mercadería", "B. Logística nacional", "C. Gastos portuarios", "D. Aduana y certificaciones", "E. Transporte internacional"],
  CIF: ["A. Mercadería", "B. Logística nacional", "C. Gastos portuarios", "D. Aduana y certificaciones", "E. Transporte internacional"],
  CPT: ["A. Mercadería", "B. Logística nacional", "C. Gastos portuarios", "D. Aduana y certificaciones", "E. Transporte internacional"],
  CIP: ["A. Mercadería", "B. Logística nacional", "C. Gastos portuarios", "D. Aduana y certificaciones", "E. Transporte internacional"],
  DAP: GRUPOS_COSTO_DESDE("A", "E"),
  DPU: GRUPOS_COSTO_DESDE("A", "E"),
  DDP: GRUPOS_COSTO_DESDE("A", "E"),
};

function GRUPOS_COSTO_DESDE(_a: string, _b: string): string[] {
  return [
    "A. Mercadería",
    "B. Logística nacional",
    "C. Gastos portuarios",
    "D. Aduana y certificaciones",
    "E. Transporte internacional",
  ];
}

export function costoConceptoUsd(c: ConceptoCosto, params: ParametrosSimulacion, baseValorMercaderia: number): number {
  if (c.incluidoEnOtraTarifa) return 0;
  let total: number;
  switch (c.unidad) {
    case "por_tonelada":
      total = c.importe * params.cantidadTn * c.cantidad;
      break;
    case "por_contenedor":
      total = c.importe * params.contenedores * c.cantidad;
      break;
    case "por_operacion":
      total = c.importe * c.cantidad;
      break;
    case "por_dia":
      total = c.importe * c.cantidad;
      break;
    case "porcentaje":
      total = (c.importe / 100) * baseValorMercaderia * c.cantidad;
      break;
  }
  if (c.moneda === "ARS") total = params.tipoCambioArs > 0 ? total / params.tipoCambioArs : 0;
  return total;
}

export interface ResultadoSimulacion {
  porGrupo: { grupo: string; totalUsd: number; asumidoVendedor: boolean }[];
  costoMercaderiaUsd: number;
  costoVendedorUsd: number;
  costoTotalUsd: number;
  costoPorTnUsd: number;
  precioMinimoTnUsd: number;
  precioFobTnUsd: number;
  precioCfrTnUsd: number;
  precioCifTnUsd: number;
  margenPct: number;
  pendientesVerificacion: string[];
}

export function simular(conceptos: ConceptoCosto[], params: ParametrosSimulacion): ResultadoSimulacion {
  const baseMercaderia =
    conceptos
      .filter((c) => c.grupo === "A. Mercadería" && !c.incluidoEnOtraTarifa)
      .reduce((acc, c) => acc + costoConceptoUsd(c, params, 0), 0) || params.cantidadTn * 500;

  const gruposVendedor = GRUPOS_VENDEDOR_POR_INCOTERM[params.incoterm] ?? GRUPOS_VENDEDOR_POR_INCOTERM["FOB"] ?? [];

  const porGrupo = GRUPOS_COSTO_DESDE("A", "F").map((grupo) => {
    const items = conceptos.filter((c) => c.grupo === grupo);
    const totalUsd = items.reduce((acc, c) => {
      // Los porcentajes se calculan sobre el valor de la mercadería
      return acc + costoConceptoUsd(c, params, baseMercaderia);
    }, 0);
    const asumidoVendedor =
      grupo === "F. Gastos comerciales y financieros" ? true : gruposVendedor.includes(grupo);
    return { grupo, totalUsd, asumidoVendedor };
  });

  const costoMercaderiaUsd = porGrupo.find((g) => g.grupo === "A. Mercadería")?.totalUsd ?? 0;
  const costoVendedorUsd = porGrupo.filter((g) => g.asumidoVendedor).reduce((a, g) => a + g.totalUsd, 0);
  const costoTotalUsd = porGrupo.reduce((a, g) => a + g.totalUsd, 0);

  const costoPorTnUsd = params.cantidadTn > 0 ? costoVendedorUsd / params.cantidadTn : 0;
  const precioMinimoTnUsd = costoPorTnUsd;
  const precioConMargen = costoPorTnUsd * (1 + params.margenPct / 100);

  // Escenarios de referencia: precio por tn asumiendo cada estructura de costos
  const costoHasta = (grupos: string[]) =>
    porGrupo.filter((g) => grupos.includes(g.grupo) || g.grupo === "F. Gastos comerciales y financieros").reduce((a, g) => a + g.totalUsd, 0) /
    Math.max(params.cantidadTn, 1);

  const fob = costoHasta(GRUPOS_VENDEDOR_POR_INCOTERM["FOB"] ?? []) * (1 + params.margenPct / 100);
  const cfr = costoHasta((GRUPOS_VENDEDOR_POR_INCOTERM["CFR"] ?? []).filter((g) => g !== "E. Transporte internacional" || true)) * (1 + params.margenPct / 100);
  const cif = cfr; // seguro internacional incluido en E

  const pendientesVerificacion = conceptos.filter((c) => c.tipoDato === "pendiente").map((c) => c.concepto);

  return {
    porGrupo,
    costoMercaderiaUsd,
    costoVendedorUsd,
    costoTotalUsd,
    costoPorTnUsd,
    precioMinimoTnUsd,
    precioFobTnUsd: params.incoterm === "FOB" ? precioConMargen : fob,
    precioCfrTnUsd: params.incoterm === "CFR" || params.incoterm === "CIF" ? precioConMargen : cfr,
    precioCifTnUsd: params.incoterm === "CIF" ? precioConMargen : cif,
    margenPct: params.margenPct,
    pendientesVerificacion,
  };
}
