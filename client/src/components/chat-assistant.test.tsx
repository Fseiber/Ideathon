import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type ApiOrder } from "@/lib/api";
import { ChatAssistantProvider, useChatAssistant } from "./chat-assistant";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, sendChat: vi.fn() };
});
vi.mock("@/lib/store", () => ({ useAppStore: vi.fn() }));

const { sendChat } = await import("@/lib/api");
const { useAppStore } = await import("@/lib/store");

const order: ApiOrder = { id: "order-1", status: "COTIZADA", lotId: 1, tokenCode: "ARROZ", destination: "Asunción", tons: 20, incoterm: "CFR", pricePerTonCents: 60000, subtotalCents: 1200000, freightCents: 150000, exportDutyPct: 5, exportDutyCents: 60000, totalCents: 1350000, advanceCents: 405000, balanceCents: 945000, events: [], seal: null };

function renderAssistant(rol: "comprador" | "productor" | "exportador" = "comprador") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(useAppStore).mockReturnValue({ state: { rol }, dispatch: vi.fn() } as never);
  return render(<QueryClientProvider client={queryClient}><ChatAssistantProvider><OpenButton /></ChatAssistantProvider></QueryClientProvider>);
}

function OpenButton() { const { open } = useChatAssistant(); return <button onClick={() => open()}>Abrir</button>; }

beforeEach(() => { vi.mocked(sendChat).mockReset(); });

describe("ChatAssistant", () => {
  it("sends only the user message, without the visual greeting", async () => {
    vi.mocked(sendChat).mockResolvedValue({ reply: "Listo", order: null, agent: "gemini" });
    renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    const input = await screen.findByPlaceholderText(/20 toneladas/);
    fireEvent.change(input, { target: { value: "20 tn a Asunción CFR" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(sendChat).toHaveBeenCalledWith([{ role: "user", content: "20 tn a Asunción CFR" }]));
  });

  it("renders a quote and its totals", async () => {
    vi.mocked(sendChat).mockResolvedValue({ reply: "Cotización lista", order, agent: "stub" });
    renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.change(await screen.findByPlaceholderText(/20 toneladas/), { target: { value: "20 tn" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText(/13\.500/)).toBeInTheDocument();
    expect(screen.getByText(/no suma al total/)).toBeInTheDocument();
  });

  it("does not render a quote for a null order", async () => {
    vi.mocked(sendChat).mockResolvedValue({ reply: "Faltan datos", order: null, agent: "gemini" });
    renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.change(await screen.findByPlaceholderText(/20 toneladas/), { target: { value: "Hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("Faltan datos");
    expect(screen.queryByText(/Cotización #/)).not.toBeInTheDocument();
  });

  it("shows the role switch for non-buyers", async () => {
    const dispatch = vi.fn();
    vi.mocked(useAppStore).mockReturnValue({ state: { rol: "productor" }, dispatch } as never);
    render(<QueryClientProvider client={new QueryClient()}><ChatAssistantProvider><OpenButton /></ChatAssistantProvider></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(await screen.findByText("El asistente es para compradores")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar a Comprador / Importador" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "setRol", rol: "comprador" });
  });

  it("keeps the user message when chat fails", async () => {
    vi.mocked(sendChat).mockRejectedValue(new ApiError("STELLAR_ERROR", "x", 502));
    renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.change(await screen.findByPlaceholderText(/20 toneladas/), { target: { value: "mensaje" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("mensaje")).toBeInTheDocument();
    expect(await screen.findByText(/Stellar testnet no respondió/)).toBeInTheDocument();
  });

  it("does not send twice on rapid Enter", async () => {
    vi.mocked(sendChat).mockImplementation(() => new Promise(() => {}));
    renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    const input = await screen.findByPlaceholderText(/20 toneladas/);
    fireEvent.change(input, { target: { value: "mensaje" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(1));
  });

  it("starts a fresh chat context after a quote", async () => {
    vi.mocked(sendChat).mockResolvedValueOnce({ reply: "Cotización", order, agent: "stub" }).mockResolvedValueOnce({ reply: "Nueva cotización", order: null, agent: "stub" });
    renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    const input = await screen.findByPlaceholderText(/20 toneladas/);
    fireEvent.change(input, { target: { value: "20 tn para Asunción CFR" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(1));
    fireEvent.change(await screen.findByPlaceholderText(/20 toneladas/), { target: { value: "50 tn para Brasil FOB" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(sendChat).toHaveBeenCalledTimes(2));
    expect(vi.mocked(sendChat).mock.calls[1]?.[0]).toEqual([{ role: "user", content: "50 tn para Brasil FOB" }]);
  });
});
