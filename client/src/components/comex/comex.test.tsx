import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => <a href={to} className={className}>{children}</a>,
}));

import { AuthProvider, RequireAuth } from "@/lib/auth";
import { ComexLoginPage } from "./login-page";
import { ComexNav } from "./comex-nav";
import { ComexCompaniesPage } from "./companies-page";

const TOKEN = "f".repeat(64);
const comexUser = { id: 2, email: "ana@agroflow.test", name: "Ana Comex", roles: ["COMEX"] };
const adminUser = { id: 1, email: "admin@agroflow.test", name: "Admin", roles: ["ADMIN", "COMEX"] };
const company = { id: 9, name: "Molino Arrocero Demo", taxId: null, country: "Argentina", province: "Corrientes", roles: ["MOLINO", "EXPORTADOR"], notes: null, createdAt: "", updatedAt: "", contacts: [] };

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

function mockBackend(me: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith("/api/auth/login")) return json({ token: TOKEN, user: comexUser });
    if (url.endsWith("/api/auth/me")) return me ? json(me) : json({ error: { code: "UNAUTHENTICATED", message: "x" } }, 401);
    if (url.includes("/api/comex/companies")) return json([company]);
    return json([]);
  });
}

function renderWithAuth(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AuthProvider>{ui}</AuthProvider></QueryClientProvider>);
}

beforeEach(() => { navigate.mockReset(); window.sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("COMEX auth", () => {
  it("el guard redirige a /comex/login sin sesión", async () => {
    mockBackend(null);
    renderWithAuth(<RequireAuth><p>contenido protegido</p></RequireAuth>);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/comex/login" }));
    expect(screen.queryByText("contenido protegido")).not.toBeInTheDocument();
  });

  it("login exitoso muestra Empresas", async () => {
    const fetchMock = mockBackend(comexUser);
    renderWithAuth(<><ComexLoginPage /><RequireAuth><ComexCompaniesPage /></RequireAuth></>);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@agroflow.test" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "una-clave-larga" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/comex/empresas" }));
    expect(await screen.findByRole("heading", { name: "Empresas" })).toBeInTheDocument();
    expect(await screen.findByText("Molino Arrocero Demo")).toBeInTheDocument();
    const companiesCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/api/comex/companies"));
    expect(new Headers(companiesCall?.[1]?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(window.sessionStorage.getItem("agroflow.comex.session") ?? "{}").user.name).toBe("Ana Comex");
  });

  it("un usuario no ADMIN no ve Usuarios; un ADMIN sí", async () => {
    window.sessionStorage.setItem("agroflow.comex.session", JSON.stringify({ token: TOKEN, user: comexUser }));
    mockBackend(comexUser);
    const view = renderWithAuth(<ComexNav pathname="/" />);
    expect(await screen.findByText("Sesión: Ana Comex")).toBeInTheDocument();
    expect(screen.getByText("Empresas")).toBeInTheDocument();
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    view.unmount();
    vi.restoreAllMocks();
    window.sessionStorage.setItem("agroflow.comex.session", JSON.stringify({ token: TOKEN, user: adminUser }));
    mockBackend(adminUser);
    renderWithAuth(<ComexNav pathname="/" />);
    expect(await screen.findByText("Usuarios")).toBeInTheDocument();
  });

  it("un 401 limpia la sesión y redirige a /comex/login", async () => {
    window.sessionStorage.setItem("agroflow.comex.session", JSON.stringify({ token: TOKEN, user: comexUser }));
    mockBackend(null);
    renderWithAuth(<ComexNav pathname="/" />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/comex/login" }));
    expect(window.sessionStorage.getItem("agroflow.comex.session")).toBeNull();
    expect(await screen.findByText("Iniciar sesión")).toBeInTheDocument();
  });
});
