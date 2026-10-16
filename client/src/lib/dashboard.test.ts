import { describe, expect, it } from "vitest";

import { computeKpis } from "./dashboard";

const lot = { id: 1, product: "Arroz", variety: "Largo fino", province: "Corrientes", presentation: "Bolsas 25 kg", brokenPct: 5, moisturePct: 13, pricePerTonCents: 60000, tonsTotal: 1000, tonsAvailable: 980, mintTxHash: "", explorerUrl: null, createdAt: "2026-01-01" };
const order = (status: "COMPLETADA" | "FONDEADA", totalCents: number, advanceCents: number) => ({ id: status, status, lotId: 1, tokenCode: "ARROZ" as const, destination: "Asunción", tons: 20, incoterm: "CFR" as const, subtotalCents: totalCents, pricePerTonCents: 60000, freightCents: 0, exportDutyPct: 5, exportDutyCents: 0, totalCents, advanceCents, balanceCents: totalCents - advanceCents, events: [], seal: null });

describe("computeKpis", () => {
  it("calcula indicadores de lotes y órdenes", () => expect(computeKpis([lot], [order("COMPLETADA", 1350000, 405000), order("FONDEADA", 600000, 180000)])).toEqual({ tonsAvailable: 980, tonsTokenized: 1000, activeOrders: 1, escrowCents: 420000, completedOrders: 1, settledCents: 1350000 }));
  it("devuelve ceros para listas vacías", () => expect(computeKpis([], [])).toEqual({ tonsAvailable: 0, tonsTokenized: 0, activeOrders: 0, escrowCents: 0, completedOrders: 0, settledCents: 0 }));
});
