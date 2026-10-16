import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, centsToUsd, partyFromRol, shortHash } from "./api";

describe("api", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends the party header to the backend proxy", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await api<{ ok: boolean }>("/orders", { party: 2 });

    expect(fetchMock).toHaveBeenCalledWith("/api/orders", expect.objectContaining({ headers: expect.any(Headers) }));
    const request = fetchMock.mock.calls[0]?.[1];
    expect((request?.headers as Headers).get("x-party-id")).toBe("2");
  });

  it("maps structured backend errors to ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { code: "INVALID_STATE", message: "x" } }), { status: 409 }));

    await expect(api("/orders/order-1/fund", { method: "POST", party: 2 })).rejects.toEqual(expect.objectContaining({ code: "INVALID_STATE", status: 409, message: "x" }));
  });

  it("maps non-JSON errors to NETWORK_ERROR", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>error</html>", { status: 500, headers: { "content-type": "text/html" } }));

    await expect(api("/health")).rejects.toEqual(expect.objectContaining({ code: "NETWORK_ERROR", status: 500 }));
  });

  it("converts cents to USD", () => {
    expect(centsToUsd(945000)).toBe(9450);
    expect(centsToUsd(405000)).toBe(4050);
  });

  it("shortens long Stellar hashes", () => {
    expect(shortHash("cc7285369074b567c81bad73016da164e7e8ab52084352e787a715c4d87f551b")).toBe("cc728536…d87f551b");
  });

  it("maps exportador to read-only access", () => {
    expect(partyFromRol("exportador")).toBeNull();
  });

  it("exposes ApiError as the error type", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));

    await expect(api("/health")).rejects.toBeInstanceOf(ApiError);
  });
});
