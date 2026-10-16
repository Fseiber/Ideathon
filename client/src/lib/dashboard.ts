import type { ApiLot, ApiOrder } from "./api";

export function computeKpis(lots: ApiLot[], orders: ApiOrder[]) {
  const activeStatuses = new Set(["COTIZADA", "PROCESANDO", "FONDEADA", "DESPACHADA"]);
  const escrowStatuses = new Set(["FONDEADA", "DESPACHADA"]);
  const completedOrders = orders.filter((order) => order.status === "COMPLETADA");
  return {
    tonsAvailable: lots.reduce((total, lot) => total + lot.tonsAvailable, 0),
    tonsTokenized: lots.reduce((total, lot) => total + lot.tonsTotal, 0),
    activeOrders: orders.filter((order) => activeStatuses.has(order.status)).length,
    escrowCents: orders.filter((order) => escrowStatuses.has(order.status)).reduce((total, order) => total + order.totalCents - order.advanceCents, 0),
    completedOrders: completedOrders.length,
    settledCents: completedOrders.reduce((total, order) => total + order.totalCents, 0),
  };
}
