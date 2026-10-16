import { centsToUsd, type ApiLot, type ApiOrder } from "./api";

export function arrozAssetUrl(issuerPublic: string | null) { return issuerPublic ? `https://stellar.expert/explorer/testnet/asset/ARROZ-${issuerPublic}` : null; }

export function lotHistory(lotId: number, orders: ApiOrder[]) {
  const selected = orders.filter((order) => order.lotId === lotId).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const completed = selected.filter((order) => order.status === "COMPLETADA");
  return { orders: selected, completed: completed.length, tonsSettled: completed.reduce((sum, order) => sum + order.tons, 0), tonsInEscrow: selected.filter((order) => ["FONDEADA", "DESPACHADA", "PROCESANDO"].includes(order.status)).reduce((sum, order) => sum + order.tons, 0) };
}

export function qualityRows(lot: ApiLot) {
  return [{ label: "Molino", value: lot.supplier?.name ?? "No disponible" }, { label: "Variedad", value: lot.variety }, { label: "Provincia", value: lot.province }, { label: "Presentación", value: lot.presentation }, { label: "Quebrado", value: lot.brokenPct === null ? "Sin dato" : `${lot.brokenPct}%` }, { label: "Humedad", value: lot.moisturePct === null ? "Sin dato" : `${lot.moisturePct}%` }, { label: "Precio por tonelada", value: centsToUsd(lot.pricePerTonCents).toLocaleString("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) }];
}
