import { ApiError, type OrderStatus } from "./api";
import type { Rol } from "@/data/demo";

export const FLOW_STEPS = [
  { status: "COTIZADA", label: "Cotización emitida" },
  { status: "FONDEADA", label: "Escrow fondeado · tokens bloqueados · anticipo liberado" },
  { status: "DESPACHADA", label: "Mercadería despachada" },
  { status: "COMPLETADA", label: "Liquidación atómica DvP" },
] as const;

export function stepIndex(status: OrderStatus): number {
  if (status === "COTIZADA") return 0;
  if (status === "FONDEADA") return 1;
  if (status === "DESPACHADA") return 2;
  if (status === "COMPLETADA") return 3;
  return -1;
}

export type FlowAction = "fund" | "dispatch" | "confirm";

export function nextAction(status: OrderStatus, rol: Rol): { action: FlowAction; label: string; requiredRol: "comprador" | "productor"; allowed: boolean; reason?: string } | null {
  const action = status === "COTIZADA"
    ? { action: "fund" as const, label: "Fondear escrow (USDC)", requiredRol: "comprador" as const }
    : status === "FONDEADA"
      ? { action: "dispatch" as const, label: "Confirmar despacho", requiredRol: "productor" as const }
      : status === "DESPACHADA"
        ? { action: "confirm" as const, label: "Confirmar recepción y liquidar", requiredRol: "comprador" as const }
        : null;
  if (!action) return null;
  const allowed = rol === action.requiredRol;
  return allowed ? { ...action, allowed } : { ...action, allowed, reason: action.requiredRol === "comprador" ? "Cambiá al rol Comprador / Importador" : "Cambiá al rol Productor / Molino" };
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_STATE") return "La orden cambió de estado. Actualizando…";
    if (error.code === "FORBIDDEN") return "Tu rol no puede ejecutar esta acción.";
    if (error.code === "STELLAR_ERROR") return "Stellar testnet no respondió. Reintentá en unos segundos.";
    if (error.code === "INSUFFICIENT_STOCK") return "No hay stock suficiente en el lote.";
  }
  return error instanceof Error && error.message ? error.message : "Error inesperado";
}
