import type { ApiLot } from "./api";

// Estado del respaldo físico de un lote. Solo un tercero independiente puede llevarlo a "Verificado".
export type EstadoRespaldo = "Declarado" | "Pendiente de verificar" | "Verificado" | "Vencido";

export const ESTADOS_RESPALDO: { estado: EstadoRespaldo; descripcion: string }[] = [
  { estado: "Declarado", descripcion: "El molino cargó cantidad y calidad. Nadie externo lo controló." },
  { estado: "Pendiente de verificar", descripcion: "Se solicitó la inspección a un certificador independiente." },
  { estado: "Verificado", descripcion: "Un tercero constató existencia y calidad en una fecha determinada." },
  { estado: "Vencido", descripcion: "La verificación perdió vigencia y debe renovarse." },
];

export const TONO_RESPALDO = {
  Declarado: "warning",
  "Pendiente de verificar": "info",
  Verificado: "success",
  Vencido: "danger",
} as const satisfies Record<EstadoRespaldo, string>;

// El backend todavía no registra verificaciones de terceros, así que todo lote está "Declarado".
export function respaldoDelLote(_lot: ApiLot): EstadoRespaldo {
  return "Declarado";
}
