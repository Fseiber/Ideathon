import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiOrder } from "@/lib/api";
import { RealOrderSheet } from "./real-order-sheet";

vi.mock("@/lib/store", () => ({ useAppStore: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, fundOrder: vi.fn(), dispatchOrder: vi.fn(), confirmDelivery: vi.fn() };
});

const { fundOrder, dispatchOrder, confirmDelivery } = await import("@/lib/api");
const { useAppStore } = await import("@/lib/store");

const order: ApiOrder = { id: "order-1", status: "COTIZADA", lotId: 1, tokenCode: "ARROZ", destination: "Asunción, PY", tons: 20, incoterm: "CFR", subtotalCents: 1200000, freightCents: 150000, totalCents: 1350000, advanceCents: 405000, balanceCents: 945000, events: [], seal: null };

function renderSheet(value: ApiOrder = order) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><RealOrderSheet order={value} open onOpenChange={() => {}} /></QueryClientProvider>);
}

beforeEach(() => { vi.mocked(fundOrder).mockReset(); vi.mocked(dispatchOrder).mockReset(); vi.mocked(confirmDelivery).mockReset(); vi.mocked(useAppStore).mockReturnValue({ state: { rol: "comprador" } } as never); });

describe("RealOrderSheet", () => {
  it("does not submit twice on a double click", async () => {
    vi.mocked(fundOrder).mockImplementation(() => new Promise<ApiOrder>(() => {}));
    renderSheet();
    const button = screen.getByRole("button", { name: "Fondear escrow (USDC)" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(fundOrder).toHaveBeenCalledTimes(1));
    expect(dispatchOrder).not.toHaveBeenCalled();
    expect(confirmDelivery).not.toHaveBeenCalled();
  });

  it("disables a producer action for the buyer role", () => {
    renderSheet({ ...order, status: "FONDEADA" });
    expect(screen.getByRole("button", { name: "Confirmar despacho" })).toBeDisabled();
    expect(screen.getByText("Cambiá al rol Productor / Molino")).toBeInTheDocument();
  });

  it("shows Stellar errors", async () => {
    vi.mocked(fundOrder).mockRejectedValue(new ApiError("STELLAR_ERROR", "x", 502));
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Fondear escrow (USDC)" }));
    expect(await screen.findByText("Stellar testnet no respondió. Reintentá en unos segundos.")).toBeInTheDocument();
  });

  it("links completed orders to blockchain verification", () => {
    renderSheet({ ...order, status: "COMPLETADA" });
    expect(screen.getByRole("link", { name: "Ver verificación blockchain" })).toHaveAttribute("href", "/trazabilidad?op=api:order-1");
  });

  it("shows backend amounts", () => {
    renderSheet();
    expect(screen.getByText(/13\.500|13,500/)).toBeInTheDocument();
    expect(screen.getByText(/4\.050|4,050/)).toBeInTheDocument();
    expect(screen.getByText(/9\.450|9,450/)).toBeInTheDocument();
  });
});
