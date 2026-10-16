import { describe, expect, it } from "vitest";

import type { ApiEvent } from "./api";
import { eventLink, parseSelectId, sortEvents } from "./order-view";

const event = (createdAt: string, txHash: string | null, explorerUrl: string | null = null): ApiEvent => ({ type: "SETTLE_DVP", txHash, explorerUrl, note: null, createdAt });

describe("order view helpers", () => {
  it("builds a StellarExpert link for a valid transaction hash", () => {
    const hash = "cc7285369074b567c81bad73016da164e7e8ab52084352e787a715c4d87f551b";
    expect(eventLink(event("2026-01-01", hash))).toBe(`https://stellar.expert/explorer/testnet/tx/${hash}`);
  });

  it("does not link mock hashes", () => expect(eventLink(event("2026-01-01", "mock-123"))).toBeNull());
  it("preserves an explicit explorer URL", () => expect(eventLink(event("2026-01-01", null, "https://example.test/tx"))).toBe("https://example.test/tx"));
  it("sorts events defensively", () => {
    expect(sortEvents(undefined)).toEqual([]);
    expect(sortEvents([event("2026-02-01", null), event("2026-01-01", null)])).toEqual([event("2026-01-01", null), event("2026-02-01", null)]);
  });
  it("parses real and demo selector ids", () => {
    expect(parseSelectId("api:7")).toEqual({ kind: "real", id: "7" });
    expect(parseSelectId("OP-001")).toEqual({ kind: "demo", id: "OP-001" });
  });
});
