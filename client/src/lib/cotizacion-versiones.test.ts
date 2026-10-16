import { describe, expect, it } from "vitest";
import { COTIZACIONES_INICIALES, type Cotizacion } from "@/data/demo";
import { aceptar, proponerVersion, terminosDe, versionesDe, versionVigente, vigentes } from "./cotizacion-versiones";

const { versiones: _v, ...semilla } = COTIZACIONES_INICIALES[0]!;
const base: Cotizacion = { ...semilla, estado: "Enviada" };

describe("versiones de cotización", () => {
  it("crea una v1 implícita para cotizaciones sin historial", () => {
    expect(versionesDe(base)).toHaveLength(1);
    expect(versionVigente(base).terminos.precioTnUsd).toBe(base.precioTnUsd);
  });

  it("registra qué cambió y quién lo propuso", () => {
    const v2 = proponerVersion(base, "comprador", { ...terminosDe(base), cantidadTn: 30 }, "2026-10-16", "Menos volumen")!;
    expect(v2.cantidadTn).toBe(30);
    expect(versionVigente(v2)).toMatchObject({ numero: 2, autor: "comprador", nota: "Menos volumen", cambios: ["Cantidad: 40 tn → 30 tn"] });
    expect(v2.estado).toBe("En negociación");
    expect(vigentes(v2)).toEqual({ comprador: "2026-10-16" });
  });

  it("no crea versión si no hay cambios", () => {
    expect(proponerVersion(base, "vendedor", terminosDe(base), "2026-10-16")).toBeNull();
  });

  it("solo queda aceptada cuando ambas partes aceptan la misma versión", () => {
    const unaParte = aceptar(base, "vendedor", "2026-10-16");
    expect(unaParte.estado).toBe("Enviada");
    expect(aceptar(unaParte, "comprador", "2026-10-17").estado).toBe("Aceptada");
  });

  it("una nueva versión invalida la aceptación anterior de la otra parte", () => {
    const aceptadaPorVendedor = aceptar(base, "vendedor", "2026-10-16");
    const v2 = proponerVersion(aceptadaPorVendedor, "comprador", { ...terminosDe(base), precioTnUsd: 600 }, "2026-10-17")!;
    expect(vigentes(v2)["vendedor"]).toBeUndefined();
    expect(versionesDe(v2)[0]!.aceptaciones).toEqual({ vendedor: "2026-10-16" });
    expect(aceptar(v2, "vendedor", "2026-10-18").estado).toBe("Aceptada");
  });
});
