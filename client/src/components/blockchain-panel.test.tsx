import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiOrder } from "@/lib/api";
import { BlockchainPanel } from "./blockchain-panel";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, sealOrder: vi.fn(), verifyOrder: vi.fn() };
});

const { sealOrder, verifyOrder } = await import("@/lib/api");

const baseOrder: ApiOrder = {
  id: "order-1",
  status: "COMPLETADA",
  lotId: 1,
  tokenCode: "ARROZ",
  destination: "Asunción, PY",
  tons: 20,
  incoterm: "CFR",
  subtotalCents: 1200000,
  freightCents: 150000,
  totalCents: 1350000,
  advanceCents: 405000,
  balanceCents: 945000,
  events: ["FUND_ESCROW", "LOCK_TOKENS", "RELEASE_ADVANCE", "SETTLE_DVP"].map((type, index) => ({ type: type as ApiOrder["events"][number]["type"], txHash: `${index + 1}`.repeat(64), explorerUrl: null, note: null, createdAt: `2026-01-0${index + 1}T00:00:00.000Z` })),
  seal: { hash: "a".repeat(64), topicId: "0.0.123", sequenceNumber: 7, hashscanUrl: "https://hashscan.io/testnet/topic/0.0.123/message/7", mode: "testnet" },
};

function renderPanel(order = baseOrder) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><BlockchainPanel order={order} /></QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(sealOrder).mockReset();
  vi.mocked(verifyOrder).mockReset();
});

describe("BlockchainPanel", () => {
  it("renders Stellar and HashScan links", () => {
    renderPanel();
    expect(screen.getAllByRole("link").filter((link) => link.textContent?.includes("Ver en StellarExpert"))).toHaveLength(4);
    expect(screen.getByRole("link", { name: /Ver en HashScan/ })).toHaveAttribute("href", baseOrder.seal?.hashscanUrl);
  });

  it("renders backend cent amounts as USD", () => {
    renderPanel();
    expect(screen.getByText(/13\.500|13,500/)).toBeInTheDocument();
    expect(screen.getByText(/9\.450|9,450/)).toBeInTheDocument();
  });

  it("allows sealing a completed unsealed order", async () => {
    vi.mocked(sealOrder).mockResolvedValue({ ...baseOrder, seal: baseOrder.seal });
    renderPanel({ ...baseOrder, seal: null });
    fireEvent.click(screen.getByRole("button", { name: "Sellar en Hedera" }));
    await waitFor(() => expect(sealOrder).toHaveBeenCalledWith("order-1"));
  });

  it("shows the not-sealed message for a 409 verification error", async () => {
    vi.mocked(verifyOrder).mockRejectedValue(new ApiError("NOT_SEALED", "La orden no está sellada", 409));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Verificar integridad" }));
    expect(await screen.findByText("La orden aún no está sellada")).toBeInTheDocument();
  });
});
