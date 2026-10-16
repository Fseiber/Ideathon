import { describe, expect, it } from "vitest";

import type { ApiLot, ApiOrder } from "./api";
import { buildReceipt } from "./receipt";

const parties = [{ id: 1, name: "Molino", role: "MOLINO", stellarPublicKey: "GMILL" }, { id: 2, name: "Buyer", role: "COMPRADOR", stellarPublicKey: "GBUYER" }];
const lot: ApiLot = { id: 1, product: "Arroz", variety: "Largo fino", province: "Corrientes", presentation: "Bolsas 25 kg", brokenPct: 5, moisturePct: 13, pricePerTonCents: 60000, tonsTotal: 1000, tonsAvailable: 980, mintTxHash: "a", explorerUrl: null, createdAt: "2026-01-01" };
const order = (status: ApiOrder["status"], events: ApiOrder["events"]): ApiOrder => ({ id: "order", millId: 1, buyerId: 2, status, lotId: 1, tokenCode: "ARROZ", destination: "Brasil", tons: 20, incoterm: "FOB", pricePerTonCents: 60000, subtotalCents: 1200000, freightCents: 0, exportDutyPct: 5, exportDutyCents: 60000, totalCents: 1200000, advanceCents: 360000, balanceCents: 840000, events, seal: null } as ApiOrder);
const txEvents = ["FUND_ESCROW", "LOCK_TOKENS", "RELEASE_ADVANCE", "SETTLE_DVP"].map((type, index) => ({ type: type as ApiOrder["events"][number]["type"], txHash: `${index + 1}`.repeat(64), explorerUrl: null, note: null, createdAt: `2026-01-0${index + 1}` }));

describe("buildReceipt", () => {
  it("returns null for unfinished orders", () => expect(buildReceipt(order("FONDEADA", []), lot, parties)).toBeNull());
  it("builds ordered transactions and parties", () => { const receipt = buildReceipt(order("COMPLETADA", [...txEvents, { type: "DISPATCHED", txHash: null, explorerUrl: null, note: null, createdAt: "2026-01-05" }]), lot, parties); expect(receipt?.transactions).toHaveLength(4); expect(receipt?.transactions.map((tx) => tx.txHash)).toEqual(txEvents.map((event) => event.txHash)); expect(receipt?.seller?.name).toBe("Molino"); expect(receipt?.buyer?.name).toBe("Buyer"); expect(receipt?.settledAt).toBe("2026-01-04"); });
  it("falls back to the lot id", () => expect(buildReceipt(order("COMPLETADA", txEvents), undefined, parties)?.lot).toEqual({ id: 1 }));
});
