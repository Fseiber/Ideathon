import { describe, expect, it } from "vitest";
import type { ApiLot, ApiOrder } from "./api";
import { arrozAssetUrl, lotHistory, qualityRows } from "./passport";

const lot: ApiLot = { id: 1, product: "Arroz", variety: "Largo fino", province: "Corrientes", presentation: "Bolsas 25 kg", brokenPct: null, moisturePct: 5, pricePerTonCents: 60000, tonsTotal: 1000, tonsAvailable: 820, mintTxHash: "a", explorerUrl: null, createdAt: "2026-01-01" };
const order = (status: ApiOrder["status"], lotId: number, tons: number, createdAt: string): ApiOrder => ({ id: `${status}-${lotId}-${tons}`, lotId, status, tons, createdAt, tokenCode: "ARROZ", destination: "Brasil", incoterm: "FOB", pricePerTonCents: 60000, subtotalCents: 0, freightCents: 0, exportDutyPct: 0, exportDutyCents: 0, totalCents: 0, advanceCents: 0, balanceCents: 0, events: [], seal: null });

describe("passport helpers", () => {
  it("builds asset links safely", () => { expect(arrozAssetUrl("GAAGtest")).toBe("https://stellar.expert/explorer/testnet/asset/ARROZ-GAAGtest"); expect(arrozAssetUrl(null)).toBeNull(); });
  it("summarizes lot order history", () => { const history = lotHistory(1, [order("COMPLETADA", 1, 20, "2026-01-02"), order("FONDEADA", 1, 10, "2026-01-01"), order("COMPLETADA", 2, 30, "2026-01-03")]); expect(history.completed).toBe(1); expect(history.tonsSettled).toBe(20); expect(history.tonsInEscrow).toBe(10); expect(history.orders).toHaveLength(2); });
  it("formats quality values", () => { expect(qualityRows(lot).find((row) => row.label === "Quebrado")?.value).toBe("Sin dato"); expect(qualityRows({ ...lot, brokenPct: 5 }).find((row) => row.label === "Quebrado")?.value).toBe("5%"); });
});
