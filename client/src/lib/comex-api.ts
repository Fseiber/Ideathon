import { ApiError } from "./api";

// Cliente de /api/auth y /api/comex: autenticación por Bearer token (usuarios internos),
// independiente del header x-party-id del flujo Stellar. El token nunca se loguea.

export type UserRole = "ADMIN" | "COMEX" | "DOCS" | "FINANCE";
export type CompanyRole = "MOLINO" | "COMPRADOR" | "EXPORTADOR" | "INTERMEDIARIO";
export const USER_ROLES: UserRole[] = ["ADMIN", "COMEX", "DOCS", "FINANCE"];
export const COMPANY_ROLES: CompanyRole[] = ["MOLINO", "COMPRADOR", "EXPORTADOR", "INTERMEDIARIO"];

export interface ComexUser { id: number; email: string; name: string; roles: UserRole[]; active?: boolean }
export interface CompanyContact { id: number; name: string; email: string | null; phone: string | null; position: string | null }
export interface Company { id: number; name: string; taxId: string | null; country: string; province: string | null; roles: CompanyRole[]; notes: string | null; createdAt: string; updatedAt: string; contacts: CompanyContact[] }
export interface CompanyInput { name: string; country: string; roles: CompanyRole[]; taxId?: string | null; province?: string | null; notes?: string | null }
export interface ContactInput { name: string; email?: string | null; phone?: string | null; position?: string | null }
export interface NewUserInput { email: string; name: string; password: string; roles: UserRole[] }
export interface LoginResponse { token: string; user: ComexUser }

type Method = "GET" | "POST" | "PATCH" | "DELETE";
export type ComexSession = { token: string | null; onUnauthorized: () => void };

export async function comexRequest<T>(path: string, session: ComexSession, opts: { method?: Method; body?: unknown } = {}): Promise<T> {
  const headers = new Headers();
  if (session.token) headers.set("authorization", `Bearer ${session.token}`);
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  const init: RequestInit = { method: opts.method ?? "GET", headers };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError("NETWORK_ERROR", "No se pudo conectar con el backend", 0);
  }

  if (response.status === 401 && session.token) session.onUnauthorized();
  if (!response.ok) {
    let payload: unknown = null;
    try { payload = await response.json(); } catch { /* respuesta sin cuerpo JSON */ }
    const error = typeof payload === "object" && payload !== null && "error" in payload ? (payload as { error: { code?: unknown; message?: unknown } }).error : null;
    throw new ApiError(typeof error?.code === "string" ? error.code : "NETWORK_ERROR", typeof error?.message === "string" ? error.message : "El backend devolvió una respuesta inválida", response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function comexClient(session: ComexSession) {
  const call = <T,>(path: string, opts?: { method?: Method; body?: unknown }) => comexRequest<T>(path, session, opts);
  return {
    me: () => call<ComexUser>("/auth/me"),
    logout: () => call<void>("/auth/logout", { method: "POST" }),
    listCompanies: (filters: { role?: CompanyRole | ""; q?: string } = {}) => {
      const params = new URLSearchParams();
      if (filters.role) params.set("role", filters.role);
      if (filters.q?.trim()) params.set("q", filters.q.trim());
      const qs = params.toString();
      return call<Company[]>(`/comex/companies${qs ? `?${qs}` : ""}`);
    },
    createCompany: (body: CompanyInput) => call<Company>("/comex/companies", { method: "POST", body }),
    updateCompany: (id: number, body: Partial<CompanyInput>) => call<Company>(`/comex/companies/${id}`, { method: "PATCH", body }),
    addContact: (companyId: number, body: ContactInput) => call<CompanyContact>(`/comex/companies/${companyId}/contacts`, { method: "POST", body }),
    deleteContact: (id: number) => call<void>(`/comex/contacts/${id}`, { method: "DELETE" }),
    linkLotSupplier: (lotId: number, supplierCompanyId: number | null) => call<{ lotId: number; supplier: { id: number; name: string } | null }>(`/comex/lots/${lotId}/supplier`, { method: "PATCH", body: { supplierCompanyId } }),
    listUsers: () => call<ComexUser[]>("/comex/users"),
    createUser: (body: NewUserInput) => call<ComexUser>("/comex/users", { method: "POST", body }),
  };
}

export type ComexClient = ReturnType<typeof comexClient>;

export const login = (email: string, password: string) => comexRequest<LoginResponse>("/auth/login", { token: null, onUnauthorized: () => {} }, { method: "POST", body: { email, password } });

export const canWriteCompanies = (user: ComexUser | null) => !!user && user.roles.some((r) => r === "ADMIN" || r === "COMEX");
export const canManageUsers = (user: ComexUser | null) => !!user && user.roles.includes("ADMIN");
