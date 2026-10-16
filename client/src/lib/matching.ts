import { fmtTn, type Producto, type SolicitudCompra } from "@/data/demo";
import type { MatchExplainRequest } from "./api";

export type ResultadoMatch = "compatible" | "condicional" | "incompatible";

export interface AnalisisMatch {
  producto: Producto;
  resultado: ResultadoMatch;
  coincidencias: string[];
  diferencias: string[]; // negociables / a confirmar
  incumplimientos: string[]; // requisitos obligatorios incumplidos
  resumen: string;
}

/**
 * Motor de matching determinístico (demo).
 * Regla clave: una variedad diferente NUNCA es compatible,
 * aunque coincidan cantidad o presentación.
 */
export function analizarCompatibilidad(solicitud: SolicitudCompra, producto: Producto): AnalisisMatch {
  const coincidencias: string[] = [];
  const diferencias: string[] = [];
  const incumplimientos: string[] = [];

  // Requisitos obligatorios
  if (producto.variedad.toLowerCase() !== solicitud.variedad.toLowerCase()) {
    incumplimientos.push(`Variedad distinta: se requiere ${solicitud.variedad} y el lote es ${producto.variedad}`);
  } else {
    coincidencias.push(`Variedad ${producto.variedad}`);
  }

  if (producto.tipoArroz.toLowerCase() !== solicitud.tipoArroz.toLowerCase()) {
    incumplimientos.push(`Tipo de arroz distinto: se requiere ${solicitud.tipoArroz} y el lote es ${producto.tipoArroz}`);
  } else {
    coincidencias.push(`Tipo ${producto.tipoArroz}`);
  }

  if (producto.quebradoPct > solicitud.quebradoMaxPct) {
    incumplimientos.push(`Quebrado ${producto.quebradoPct}% supera el máximo de ${solicitud.quebradoMaxPct}%`);
  } else {
    coincidencias.push(`Quebrado ${producto.quebradoPct}% (máx. ${solicitud.quebradoMaxPct}%)`);
  }

  if (producto.humedadPct > solicitud.humedadMaxPct) {
    incumplimientos.push(`Humedad ${producto.humedadPct}% supera el máximo de ${solicitud.humedadMaxPct}%`);
  } else {
    coincidencias.push(`Humedad ${producto.humedadPct}% (máx. ${solicitud.humedadMaxPct}%)`);
  }

  if (producto.estado !== "Disponible") {
    incumplimientos.push(`El lote no está disponible (estado: ${producto.estado})`);
  }

  // Condiciones negociables
  if (producto.cantidadTn < solicitud.volumenTn) {
    diferencias.push(
      `Volumen insuficiente: dispone de ${producto.cantidadTn} tn frente a ${solicitud.volumenTn} tn requeridas (posible entrega parcial o complemento con otro lote)`,
    );
  } else {
    coincidencias.push(`Volumen suficiente: ${producto.cantidadTn} tn disponibles`);
  }

  if (producto.presentacion.toLowerCase() !== solicitud.presentacion.toLowerCase()) {
    diferencias.push(`Presentación distinta: se solicita ${solicitud.presentacion} y el lote está en ${producto.presentacion} (posible reenvasado)`);
  } else {
    coincidencias.push(`Presentación ${producto.presentacion}`);
  }

  const certsFaltantes = solicitud.certificaciones.filter((c) => !producto.certificaciones.includes(c));
  if (certsFaltantes.length > 0) {
    diferencias.push(`Certificaciones a gestionar: ${certsFaltantes.join(", ")}`);
  } else if (solicitud.certificaciones.length > 0) {
    coincidencias.push("Certificaciones solicitadas cubiertas");
  }

  let resultado: ResultadoMatch;
  if (incumplimientos.length > 0) resultado = "incompatible";
  else if (diferencias.length > 0) resultado = "condicional";
  else resultado = "compatible";

  const resumen = generarResumen(solicitud, producto, resultado, incumplimientos, diferencias);
  return { producto, resultado, coincidencias, diferencias, incumplimientos, resumen };
}

function generarResumen(
  solicitud: SolicitudCompra,
  producto: Producto,
  resultado: ResultadoMatch,
  incumplimientos: string[],
  diferencias: string[],
): string {
  if (resultado === "incompatible") {
    return `El lote ${producto.id} de ${producto.empresa} no cumple requisitos obligatorios de la solicitud ${solicitud.id}. ${incumplimientos[0]}. No se recomienda avanzar sin modificar la solicitud o buscar otro lote.`;
  }
  if (resultado === "condicional") {
    return `El lote ${producto.id} cumple los requisitos técnicos obligatorios, pero presenta ${diferencias.length} diferencia(s) negociable(s): ${diferencias[0]}. Se sugiere contactar al proveedor para confirmar antes de cotizar.`;
  }
  return `El lote ${producto.id} de ${producto.empresa} cumple todos los requisitos de la solicitud ${solicitud.id}: variedad, calidad, volumen y presentación. Es un candidato directo para solicitar cotización.`;
}

export function rankearResultados(analisis: AnalisisMatch[]): AnalisisMatch[] {
  const orden: Record<ResultadoMatch, number> = { compatible: 0, condicional: 1, incompatible: 2 };
  return [...analisis].sort((a, b) => orden[a.resultado] - orden[b.resultado]);
}

// Datos que se envían a Gemini: solo el resultado del motor de reglas, para que la IA lo explique sin recalcularlo.
export function pedidoExplicacion(solicitud: SolicitudCompra, resultados: AnalisisMatch[]): MatchExplainRequest {
  const { variedad, tipoArroz, volumenTn, quebradoMaxPct, humedadMaxPct, paisDestino, incoterm } = solicitud;
  return {
    solicitud: { variedad, tipoArroz, volumenTn, quebradoMaxPct, humedadMaxPct, paisDestino, incoterm },
    resultados: resultados.map((r) => ({ loteId: r.producto.id, empresa: r.producto.empresa, resultado: r.resultado, coincidencias: r.coincidencias, diferencias: r.diferencias, incumplimientos: r.incumplimientos })),
  };
}

// Explicación de respaldo cuando Gemini no está disponible.
export function explicacionPlantilla(solicitud: SolicitudCompra, resultados: AnalisisMatch[]): string {
  const c = resultados.filter((r) => r.resultado === "compatible");
  const cond = resultados.filter((r) => r.resultado === "condicional");
  const inc = resultados.filter((r) => r.resultado === "incompatible");
  let txt = `Para la solicitud de ${fmtTn(solicitud.volumenTn)} de arroz ${solicitud.tipoArroz.toLowerCase()} ${solicitud.variedad.toLowerCase()} con destino ${solicitud.paisDestino}: `;
  if (c[0]) txt += `${c.length} lote(s) cumplen todos los requisitos (${c.map((x) => x.producto.id).join(", ")}). Recomendación: solicitar cotización a ${c[0].producto.empresa}. `;
  else txt += "ningún lote cumple todos los requisitos. ";
  if (cond.length) txt += `${cond.length} lote(s) podrían negociarse: ${cond.map((x) => `${x.producto.id} (${x.diferencias[0]})`).join("; ")}. `;
  const motivo = inc[0]?.incumplimientos[0];
  if (motivo) txt += `${inc.length} lote(s) se descartan por incumplir requisitos obligatorios, principalmente: ${motivo.toLowerCase()}.`;
  return txt.trim();
}
