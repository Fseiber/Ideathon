import { describe, expect, it } from "vitest";

import type { ApiOrder } from "./api";
import { escrowView } from "./escrow-view";

const base: ApiOrder = { id: "order", status: "COTIZADA", lotId: 1, tokenCode: "ARROZ", destination: "Asunción", tons: 20, incoterm: "CFR", subtotalCents: 1200000, pricePerTonCents: 60000, freightCents: 150000, exportDutyPct: 5, exportDutyCents: 60000, totalCents: 1350000, advanceCents: 405000, balanceCents: 945000, events: [], seal: null };
const events = (types: string[]) => types.map((type, index) => ({ type: type as ApiOrder["events"][number]["type"], txHash: `${index + 1}`.repeat(64), explorerUrl: null, note: null, createdAt: `2026-01-0${index + 1}` }));

describe("escrowView", () => {
  it("starts empty", () => expect(escrowView(base)).toMatchObject({ heldCents: 0, tokensHeld: 0, releasedToMillCents: 0 }));
  it("shows funded escrow and released advance", () => expect(escrowView({ ...base, status: "FONDEADA", events: events(["FUND_ESCROW", "LOCK_TOKENS", "RELEASE_ADVANCE"]) })).toMatchObject({ heldCents: 945000, tokensHeld: 20, releasedToMillCents: 405000 }));
  it("clears escrow after settlement", () => expect(escrowView({ ...base, status: "COMPLETADA", events: events(["FUND_ESCROW", "LOCK_TOKENS", "RELEASE_ADVANCE", "DISPATCHED", "SETTLE_DVP"]) })).toMatchObject({ heldCents: 0, tokensHeld: 0, releasedToMillCents: 1350000 }));
  it("handles missing events", () => expect(escrowView({ ...base, events: undefined as unknown as ApiOrder["events"] }).stages.every((stage) => !stage.done)).toBe(true));
});
