import {
  fmtTn,
  fmtUsd,
  type Cotizacion,
  type ParteCotizacion,
  type TerminosCotizacion,
  type VersionCotizacion,
} from "@/data/demo";

export const PARTES: { id: ParteCotizacion; label: string }[] = [
  { id: "vendedor", label: "Vendedor" },
  { id: "comprador", label: "Comprador" },
];

export function terminosDe(c: Cotizacion): TerminosCotizacion {
  return {
    cantidadTn: c.cantidadTn,
    precioTnUsd: c.precioTnUsd,
    incoterm: c.incoterm,
    lugarDesignado: c.lugarDesignado,
    validezDias: c.validezDias,
    condiciones: c.condiciones,
  };
}

// Cotizaciones sin historial (las creadas desde la calculadora) arrancan con una v1 del vendedor.
export function versionesDe(c: Cotizacion): VersionCotizacion[] {
  if (c.versiones?.length) return c.versiones;
  return [{ numero: 1, fecha: c.fecha, autor: "vendedor", terminos: terminosDe(c), cambios: ["Propuesta inicial"] }];
}

export function versionVigente(c: Cotizacion): VersionCotizacion {
  const versiones = versionesDe(c);
  return versiones[versiones.length - 1]!;
}

const CAMPOS: { key: keyof TerminosCotizacion; label: string; fmt: (v: never) => string }[] = [
  { key: "cantidadTn", label: "Cantidad", fmt: (v: number) => fmtTn(v) },
  { key: "precioTnUsd", label: "Precio por tonelada", fmt: (v: number) => fmtUsd(v, v % 1 ? 2 : 0) },
  { key: "incoterm", label: "Incoterm", fmt: (v: string) => v },
  { key: "lugarDesignado", label: "Lugar designado", fmt: (v: string) => v },
  { key: "validezDias", label: "Validez", fmt: (v: number) => `${v} días` },
  { key: "condiciones", label: "Condiciones", fmt: (v: string) => v },
];

export function diferencias(antes: TerminosCotizacion, despues: TerminosCotizacion): string[] {
  return CAMPOS.filter(({ key }) => antes[key] !== despues[key]).map(
    ({ key, label, fmt }) => `${label}: ${fmt(antes[key] as never)} → ${fmt(despues[key] as never)}`,
  );
}

// Una nueva versión deja sin efecto las aceptaciones previas: cada parte debe aceptar los términos nuevos.
// Las aceptaciones de versiones anteriores quedan en el historial.
export function proponerVersion(
  c: Cotizacion,
  autor: ParteCotizacion,
  terminos: TerminosCotizacion,
  fecha: string,
  nota?: string,
): Cotizacion | null {
  const vigente = versionVigente(c);
  const cambios = diferencias(vigente.terminos, terminos);
  if (!cambios.length) return null;
  // Quien propone acepta implícitamente su propia propuesta.
  const version: VersionCotizacion = { numero: vigente.numero + 1, fecha, autor, terminos, cambios, aceptaciones: { [autor]: fecha } };
  if (nota?.trim()) version.nota = nota.trim();
  return { ...c, ...terminos, versiones: [...versionesDe(c), version], estado: "En negociación" };
}

export function aceptar(c: Cotizacion, parte: ParteCotizacion, fecha: string): Cotizacion {
  const versiones = versionesDe(c);
  const vigente = versionVigente(c);
  const aceptaciones = { ...vigente.aceptaciones, [parte]: fecha };
  const ambas = PARTES.every((p) => aceptaciones[p.id]);
  return {
    ...c,
    versiones: [...versiones.slice(0, -1), { ...vigente, aceptaciones }],
    estado: ambas ? "Aceptada" : c.estado === "Borrador" ? "Enviada" : c.estado,
  };
}

export function vigentes(c: Cotizacion): NonNullable<VersionCotizacion["aceptaciones"]> {
  return versionVigente(c).aceptaciones ?? {};
}

export function estaCerrada(c: Cotizacion) {
  return c.estado === "Aceptada" || c.estado === "Rechazada";
}
