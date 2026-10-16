import { describe, expect, it } from "vitest";
import { PRODUCTOS_INICIALES, SOLICITUDES_INICIALES } from "@/data/demo";
import { analizarCompatibilidad, explicacionPlantilla, pedidoExplicacion, rankearResultados } from "./matching";

const solicitud = SOLICITUDES_INICIALES[0]!;
const resultados = rankearResultados(PRODUCTOS_INICIALES.map((p) => analizarCompatibilidad(solicitud, p)));

describe("explicación del matching", () => {
  it("envía a Gemini solo el resultado del motor de reglas", () => {
    const pedido = pedidoExplicacion(solicitud, resultados);
    expect(pedido.resultados).toHaveLength(PRODUCTOS_INICIALES.length);
    expect(pedido.resultados[0]).toEqual({
      loteId: resultados[0]!.producto.id,
      empresa: resultados[0]!.producto.empresa,
      resultado: resultados[0]!.resultado,
      coincidencias: resultados[0]!.coincidencias,
      diferencias: resultados[0]!.diferencias,
      incumplimientos: resultados[0]!.incumplimientos,
    });
    expect(Object.keys(pedido.solicitud)).not.toContain("comprador");
  });

  it("la plantilla menciona solo lotes evaluados", () => {
    const texto = explicacionPlantilla(solicitud, resultados);
    const ids = new Set(PRODUCTOS_INICIALES.map((p) => p.id));
    for (const id of texto.match(/LOTE-[A-Z0-9]+/g) ?? []) expect(ids.has(id)).toBe(true);
    expect(texto).toContain(solicitud.paisDestino);
  });
});
