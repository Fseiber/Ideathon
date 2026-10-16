import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ to, params, children, className }: { to: string; params?: { id: string }; children: ReactNode; className?: string }) => <a href={params ? to.replace("$id", params.id) : to} className={className}>{children}</a>,
}));

import { AuthProvider } from "@/lib/auth";
import { MATCHING_DISCLAIMER } from "@/lib/lot-matching";
import { ComexRequestsPage } from "./requests-page";
import { ComexRequestDetailPage } from "./request-detail-page";

const TOKEN = "f".repeat(64);
const comexUser = { id: 2, email: "ana@agroflow.test", name: "Ana Comex", roles: ["COMEX"] };
const docsUser = { id: 3, email: "docs@agroflow.test", name: "Docs", roles: ["DOCS"] };
const buyer = { id: 5, name: "Comprador Asunción SA", taxId: null, country: "Paraguay", province: null, roles: ["COMPRADOR"], notes: null, createdAt: "", updatedAt: "", contacts: [] };
const lots = [
  { id: 1, product: "Arroz largo fino", variety: "Largo fino", province: "Corrientes", presentation: "Bolsas 25 kg", brokenPct: 5, moisturePct: 13, pricePerTonCents: 60000, tonsTotal: 30, tonsAvailable: 30, mintTxHash: "a", explorerUrl: null, createdAt: "" },
  { id: 2, product: "Arroz largo fino", variety: "Largo fino", province: "Chaco", presentation: "Bolsas 25 kg", brokenPct: null, moisturePct: 13, pricePerTonCents: 0, tonsTotal: 40, tonsAvailable: 40, mintTxHash: "b", explorerUrl: null, createdAt: "" },
];
const request = { id: 7, buyer: { id: 5, name: buyer.name }, product: "Arroz", variety: "Largo fino", tons: 50, maxBrokenPct: 6, maxMoisturePct: null, presentation: null, destination: "Asunción, PY", incoterm: "CFR", requiredBy: null, certifications: "Halal", status: "ABIERTA", notes: null, createdBy: { id: 2, name: "Ana Comex" }, createdAt: "", updatedAt: "", allowedTransitions: ["EN_ANALISIS", "CANCELADA"] };
const matching = {
  request,
  results: [
    { lotId: 1, result: "compatible", matches: ["Variedad Largo fino"], conditions: [], failures: [], partialContribution: true, contributionNote: "Aporte parcial: 30 de 50 tn", lot: { ...lots[0], commercialAvailable: 30, supplier: { id: 9, name: "Molino Arrocero Demo" } } },
    { lotId: 2, result: "condicional", matches: [], conditions: ["Quebrado no declarado (máx. 6%)"], failures: [], partialContribution: true, contributionNote: "Aporte parcial: 40 de 50 tn", lot: { ...lots[1], commercialAvailable: 40, supplier: null } },
  ],
  proposal: {
    lines: [
      { lotId: 1, supplier: { id: 9, name: "Molino Arrocero Demo" }, tons: 30, pricePerTonCents: 60000, subtotalCents: 1800000, pricePending: false, result: "compatible", conditions: [], partialContribution: true },
      { lotId: 2, supplier: null, tons: 20, pricePerTonCents: 0, subtotalCents: null, pricePending: true, result: "condicional", conditions: ["Quebrado no declarado (máx. 6%)"], partialContribution: true },
    ],
    coveredTons: 50, missingTons: 0, complete: true, summary: "Cobertura completa: 50/50 tn con 2 proveedores · Pendiente de confirmación de reservas", totalCents: 1800000, totalScope: "Subtotal conocido de mercadería, sin flete, derechos ni otros costos COMEX", weightedAvgPriceCents: 60000, pricingComplete: false, notEvaluated: ["certifications"], disclaimer: MATCHING_DISCLAIMER,
  },
  confirmedTons: 30,
};
const reservation = (id: number, lotId: number, tons: number, status: string, extra = {}) => ({ id, lotId, lot: { id: lotId, product: "Arroz largo fino", variety: "Largo fino", supplier: lotId === 1 ? { id: 9, name: "Molino Arrocero Demo" } : null }, requestId: 7, tons, status, expiresAt: new Date(Date.now() + 70 * 3600000).toISOString(), confirmedAt: null, confirmedBy: null, confirmationChannel: null, confirmationContact: null, confirmationReference: null, releasedAt: null, releaseReason: null, createdBy: { id: 2, name: "Ana Comex" }, createdAt: "", ...extra });
const reservations = { requestId: 7, requestTons: 50, confirmedTons: 30, reservations: [reservation(1, 1, 30, "CONFIRMADA", { confirmedBy: { id: 2, name: "Ana Comex" }, confirmationChannel: "WHATSAPP", confirmationContact: "Juan (molino)" }), reservation(2, 2, 20, "SOLICITADA")] };

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

function mockBackend(me: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith("/api/auth/me")) return json(me);
    if (url.includes("/api/comex/companies")) return json([buyer]);
    if (url.endsWith("/api/comex/requests") && init?.method === "POST") return json(request, 201);
    if (url.includes("/api/comex/requests/7/matching")) return json(matching);
    if (url.includes("/api/comex/requests/7/reservations/from-proposal")) return json({ created: [], reservations: reservations.reservations });
    if (url.includes("/api/comex/requests/7/reservations")) return json(reservations);
    if (url.includes("/api/comex/reservations/2/confirm")) return json(reservation(2, 2, 20, "CONFIRMADA"));
    if (url.includes("/api/comex/requests")) return json([]);
    if (url.endsWith("/api/lots")) return json(lots);
    return json([]);
  });
}

function renderAs(user: unknown, ui: ReactNode) {
  window.sessionStorage.setItem("agroflow.comex.session", JSON.stringify({ token: TOKEN, user }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AuthProvider>{ui}</AuthProvider></QueryClientProvider>);
}

beforeEach(() => { navigate.mockReset(); window.sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("Solicitudes COMEX", () => {
  it("crea una solicitud desde React y navega a su Matching", async () => {
    const fetchMock = mockBackend(comexUser);
    renderAs(comexUser, <ComexRequestsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Nueva solicitud/ }));
    const form = (await screen.findByRole("button", { name: "Crear solicitud" })).closest("form")!;
    await within(form).findByRole("option", { name: buyer.name });
    fireEvent.change(within(form).getByLabelText("Comprador"), { target: { value: "5" } });
    fireEvent.change(within(form).getByLabelText("Toneladas"), { target: { value: "50" } });
    fireEvent.change(within(form).getByLabelText("Quebrado máx. %"), { target: { value: "6" } });
    fireEvent.change(within(form).getByLabelText("Destino"), { target: { value: "Asunción, PY" } });
    fireEvent.change(within(form).getByLabelText("Incoterm"), { target: { value: "CFR" } });
    expect(await within(form).findByText(/Vista previa: 1 lote\(s\) compatible\(s\) y 1 que requieren confirmación/)).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Crear solicitud" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/comex/solicitudes/$id", params: { id: "7" } }));
    const post = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/comex/requests") && init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ buyerCompanyId: 5, variety: "Largo fino", tons: 50, maxBrokenPct: 6, maxMoisturePct: null, destination: "Asunción, PY", incoterm: "CFR" });
  });

  it("muestra el Matching multilote con precio pendiente, condiciones y leyenda", async () => {
    mockBackend(comexUser);
    renderAs(comexUser, <ComexRequestDetailPage id={7} />);
    expect(await screen.findByText("Solicitud #7 · Comprador Asunción SA")).toBeInTheDocument();
    expect(screen.getByText(MATCHING_DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByText("Subtotal con precios disponibles")).toBeInTheDocument();
    expect(screen.queryByText("Subtotal de mercadería")).not.toBeInTheDocument();
    expect(screen.getByText("Pendiente de cotización")).toBeInTheDocument();
    expect(screen.getAllByText("Requiere confirmación").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Cobertura completa: 50/50 tn con 2 proveedores · Pendiente de confirmación de reservas")).toBeInTheDocument();
    expect(screen.getByText("Aporte parcial: 30 de 50 tn", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("50 de 50 tn")).toBeInTheDocument();
    expect(screen.getByText(/No evaluado por el Matching: Certificaciones/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pasar a análisis" })).toBeInTheDocument();
  });

  it("oculta acciones de edición a usuarios de sólo lectura", async () => {
    mockBackend(docsUser);
    renderAs(docsUser, <><ComexRequestsPage /><ComexRequestDetailPage id={7} /></>);
    expect(await screen.findByText("Solicitud #7 · Comprador Asunción SA")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nueva solicitud/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pasar a análisis" })).not.toBeInTheDocument();
  });

  it("muestra reservas, indicador y aviso; solicita desde la propuesta y confirma con canal y contacto", async () => {
    const fetchMock = mockBackend(comexUser);
    renderAs(comexUser, <ComexRequestDetailPage id={7} />);
    expect(await screen.findByText("Reservado y confirmado: 30 de 50 tn")).toBeInTheDocument();
    expect(screen.getByText("Una reserva solicitada no compromete stock. Solo la confirmación del molino lo reserva hasta su vencimiento.")).toBeInTheDocument();
    expect(screen.getByText("Juan (molino)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Solicitar reservas de la propuesta" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/reservations/from-proposal") && init?.method === "POST")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    const form = screen.getByRole("form", { name: "Confirmar reserva 2" });
    fireEvent.change(within(form).getByLabelText("Canal"), { target: { value: "TELEFONO" } });
    fireEvent.change(within(form).getByLabelText("Contacto del molino"), { target: { value: "Marta, ventas" } });
    fireEvent.click(within(form).getByRole("button", { name: "Confirmar reserva" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes("/api/comex/reservations/2/confirm"));
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({ channel: "TELEFONO", contact: "Marta, ventas", reference: null });
    });
  });

  it("un usuario de sólo lectura ve las reservas sin acciones", async () => {
    mockBackend(docsUser);
    renderAs(docsUser, <ComexRequestDetailPage id={7} />);
    expect(await screen.findByText("Reservado y confirmado: 30 de 50 tn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Solicitar reservas de la propuesta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Liberar" })).not.toBeInTheDocument();
  });
});
