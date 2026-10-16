import { describe, expect, it } from "vitest";

import { ApiError } from "./api";
import { errorMessage, nextAction } from "./order-flow";

describe("order flow", () => {
  it("allows the buyer to fund a quoted order", () => expect(nextAction("COTIZADA", "comprador")).toMatchObject({ action: "fund", allowed: true }));
  it("explains when funding needs the buyer role", () => expect(nextAction("COTIZADA", "productor")).toMatchObject({ allowed: false, reason: expect.stringContaining("Comprador") }));
  it("allows the producer to dispatch a funded order", () => expect(nextAction("FONDEADA", "productor")).toMatchObject({ action: "dispatch", allowed: true }));
  it("keeps exportador read-only", () => expect(nextAction("DESPACHADA", "exportador")).toMatchObject({ allowed: false }));
  it("has no action for processing or completed orders", () => { expect(nextAction("COMPLETADA", "comprador")).toBeNull(); expect(nextAction("PROCESANDO", "exportador")).toBeNull(); });
  it("maps invalid state errors", () => expect(errorMessage(new ApiError("INVALID_STATE", "x", 409))).toBe("La orden cambió de estado. Actualizando…"));
});
