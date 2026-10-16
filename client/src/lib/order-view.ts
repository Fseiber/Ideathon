import { stellarTxUrl, type ApiEvent, type EventType, type OrderStatus } from "./api";

export const EVENT_LABEL: Record<EventType, string> = {
  FUND_ESCROW: "Pago depositado en garantía (escrow)",
  LOCK_TOKENS: "Tokens ARROZ bloqueados en escrow",
  RELEASE_ADVANCE: "Anticipo liberado al molino",
  DISPATCHED: "Mercadería despachada",
  SETTLE_DVP: "Liquidación atómica: USDC → molino · ARROZ → comprador",
  SEAL_HEDERA: "Sello inmutable en Hedera HCS",
  SEAL_ERROR: "Sello Hedera pendiente (reintentable)",
  ERROR: "Error en la operación",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  COTIZADA: "Cotizada",
  PROCESANDO: "Procesando",
  FONDEADA: "Fondeada",
  DESPACHADA: "Despachada",
  COMPLETADA: "Completada",
};

export function eventLink(event: ApiEvent): string | null {
  if (event.explorerUrl) return event.explorerUrl;
  return event.txHash && /^[0-9a-f]{64}$/.test(event.txHash) ? stellarTxUrl(event.txHash) : null;
}

export function sortEvents(events: ApiEvent[] | undefined): ApiEvent[] {
  return [...(events ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export const REAL_PREFIX = "api:";
export const toSelectId = (orderId: string) => REAL_PREFIX + orderId;
export const parseSelectId = (value: string): { kind: "real" | "demo"; id: string } => value.startsWith(REAL_PREFIX)
  ? { kind: "real", id: value.slice(REAL_PREFIX.length) }
  : { kind: "demo", id: value };
