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
    { lotId: 1, result: "condicional", matches: ["Variedad Largo fino"], conditions: ["Disponibilidad parcial: 30 de 50 tn"], failures: [], lot: { ...lots[0], supplier: { id: 9, name: "Molino Arrocero Demo" } } },
    { lotId: 2, result: "condicional", matches: [], conditions: ["Quebrado no declarado (máx. 6%)"], failures: [], lot: { ...lots[1], supplier: null } },
  ],
  proposal: {
    lines: [
      { lotId: 1, supplier: { id: 9, name: "Molino Arrocero Demo" }, tons: 30, pricePerTonCents: 60000, subtotalCents: 1800000, pricePending: false, result: "condicional", conditions: ["Disponibilidad parcial: 30 de 50 tn"] },
      { lotId: 2, supplier: null, tons: 20, pricePerTonCents: 0, subtotalCents: null, pricePending: true, result: "condicional", conditions: ["Quebrado no declarado (máx. 6%)"] },
    ],
    coveredTons: 50, missingTons: 0, complete: true, totalCents: 1800000, totalScope: "Subtotal conocido de mercadería, sin flete, derechos ni otros costos COMEX", weightedAvgPriceCents: 60000, pricingComplete: false, notEvaluated: ["certifications"], disclaimer: MATCHING_DISCLAIMER,
  },
};

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
    expect(await within(form).findByText(/Vista previa: 0 lote\(s\) compatible\(s\) y 2 que requieren confirmación/)).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Crear solicitud" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/comex/solicitudes/$id", params: { id: "7" } }));
    const post = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/comex/requests") && init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ buyerCompanyId: 5, variety: "Largo fino", tons: 50, maxBrokenPct: 6, maxMoisturePct: null, destination: "Asunción, PY", incoterm: "CFR" });
  });

  it("muestra el Matching multilote con precio pendiente, condiciones y leyenda", async () => {
    mockBackend(comexUser);
    renderAs(comexUser, <ComexRequestDetailPage id={7} />);
    expect(await screen.findByText("Solicitud #7 · Comprador Asunción SA")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(MATCHING_DISCLAIMER);
    expect(screen.getByText("Subtotal con precios disponibles")).toBeInTheDocument();
    expect(screen.queryByText("Subtotal de mercadería")).not.toBeInTheDocument();
    expect(screen.getByText("Pendiente de cotización")).toBeInTheDocument();
    expect(screen.getAllByText("Requiere confirmación").length).toBeGreaterThanOrEqual(2);
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
});
