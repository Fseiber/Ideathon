import { ApiError } from "./api";
import type { MatchResult } from "./lot-matching";

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

export type RequestStatus = "ABIERTA" | "EN_ANALISIS" | "COTIZADA" | "CERRADA" | "CANCELADA";
export const REQUEST_STATUSES: RequestStatus[] = ["ABIERTA", "EN_ANALISIS", "COTIZADA", "CERRADA", "CANCELADA"];
export const EDITABLE_REQUEST_STATUSES: RequestStatus[] = ["ABIERTA", "EN_ANALISIS"];
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = { ABIERTA: "Abierta", EN_ANALISIS: "En análisis", COTIZADA: "Cotizada", CERRADA: "Cerrada", CANCELADA: "Cancelada" };
export type Incoterm = "FOB" | "CFR";
type Ref = { id: number; name: string };
export interface PurchaseRequest { id: number; buyer: Ref; product: string; variety: string; tons: number; maxBrokenPct: number | null; maxMoisturePct: number | null; presentation: string | null; destination: string; incoterm: Incoterm; requiredBy: string | null; certifications: string | null; status: RequestStatus; notes: string | null; createdBy: Ref; createdAt: string; updatedAt: string; allowedTransitions: RequestStatus[] }
export interface PurchaseRequestInput { buyerCompanyId: number; variety: string; tons: number; destination: string; incoterm: Incoterm; product?: string; maxBrokenPct?: number | null; maxMoisturePct?: number | null; presentation?: string | null; requiredBy?: string | null; certifications?: string | null; notes?: string | null }
export interface MatchingResult { lotId: number; result: MatchResult; matches: string[]; conditions: string[]; failures: string[]; partialContribution: boolean; contributionNote: string | null; lot: { id: number; product: string; variety: string; presentation: string; brokenPct: number | null; moisturePct: number | null; tonsAvailable: number; commercialAvailable: number; pricePerTonCents: number; supplier: Ref | null } }
export interface ProposalLine { lotId: number; supplier: Ref | null; tons: number; pricePerTonCents: number; subtotalCents: number | null; pricePending: boolean; result: Exclude<MatchResult, "incompatible">; conditions: string[]; partialContribution: boolean }
export interface Proposal { lines: ProposalLine[]; coveredTons: number; missingTons: number; complete: boolean; summary: string; totalCents: number; totalScope: string; weightedAvgPriceCents: number; pricingComplete: boolean; notEvaluated: ("requiredBy" | "certifications")[]; disclaimer: string }
export interface MatchingResponse { request: PurchaseRequest; results: MatchingResult[]; proposal: Proposal; confirmedTons: number }
export type ReservationStatus = "SOLICITADA" | "CONFIRMADA" | "LIBERADA" | "VENCIDA" | "CONSUMIDA";
export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = { SOLICITADA: "Solicitada", CONFIRMADA: "Confirmada", LIBERADA: "Liberada", VENCIDA: "Vencida", CONSUMIDA: "Consumida" };
export type ConfirmationChannel = "EMAIL" | "TELEFONO" | "WHATSAPP" | "PRESENCIAL" | "OTRO";
export const CONFIRMATION_CHANNELS: { id: ConfirmationChannel; label: string }[] = [{ id: "WHATSAPP", label: "WhatsApp" }, { id: "TELEFONO", label: "Teléfono" }, { id: "EMAIL", label: "Email" }, { id: "PRESENCIAL", label: "Presencial" }, { id: "OTRO", label: "Otro" }];
export interface Reservation { id: number; lotId: number; lot: { id: number; product: string; variety: string; supplier: Ref | null }; requestId: number | null; tons: number; status: ReservationStatus; expiresAt: string; confirmedAt: string | null; confirmedBy: Ref | null; confirmationChannel: ConfirmationChannel | null; confirmationContact: string | null; confirmationReference: string | null; releasedAt: string | null; releaseReason: string | null; createdBy: Ref; createdAt: string }
export interface RequestReservations { requestId: number; requestTons: number; confirmedTons: number; reservations: Reservation[] }

type Method ="GET" | "POST" | "PATCH" | "DELETE";
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
    listRequests: (filters: { status?: RequestStatus | ""; buyerCompanyId?: number | ""; q?: string } = {}) => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.buyerCompanyId) params.set("buyerCompanyId", String(filters.buyerCompanyId));
      if (filters.q?.trim()) params.set("q", filters.q.trim());
      const qs = params.toString();
      return call<PurchaseRequest[]>(`/comex/requests${qs ? `?${qs}` : ""}`);
    },
    getRequest: (id: number) => call<PurchaseRequest>(`/comex/requests/${id}`),
    createRequest: (body: PurchaseRequestInput) => call<PurchaseRequest>("/comex/requests", { method: "POST", body }),
    updateRequest: (id: number, body: Partial<PurchaseRequestInput>) => call<PurchaseRequest>(`/comex/requests/${id}`, { method: "PATCH", body }),
    setRequestStatus: (id: number, status: RequestStatus) => call<PurchaseRequest>(`/comex/requests/${id}/status`, { method: "POST", body: { status } }),
    getMatching: (id: number) => call<MatchingResponse>(`/comex/requests/${id}/matching`),
    listReservations: (requestId: number) => call<RequestReservations>(`/comex/requests/${requestId}/reservations`),
    reserveFromProposal: (requestId: number) => call<{ created: number[]; reservations: Reservation[] }>(`/comex/requests/${requestId}/reservations/from-proposal`, { method: "POST", body: {} }),
    confirmReservation: (id: number, body: { channel: ConfirmationChannel; contact: string; reference?: string | null }) => call<Reservation>(`/comex/reservations/${id}/confirm`, { method: "POST", body }),
    releaseReservation: (id: number, reason: string) => call<Reservation>(`/comex/reservations/${id}/release`, { method: "POST", body: { reason } }),
    listUsers: () => call<ComexUser[]>("/comex/users"),
    createUser: (body: NewUserInput) => call<ComexUser>("/comex/users", { method: "POST", body }),
  };
}

export type ComexClient = ReturnType<typeof comexClient>;

export const login = (email: string, password: string) => comexRequest<LoginResponse>("/auth/login", { token: null, onUnauthorized: () => {} }, { method: "POST", body: { email, password } });

export const canWriteCompanies = (user: ComexUser | null) => !!user && user.roles.some((r) => r === "ADMIN" || r === "COMEX");
export const canWriteRequests = canWriteCompanies;
export const canWriteReservations = canWriteCompanies;
export const canManageUsers = (user: ComexUser | null) => !!user && user.roles.includes("ADMIN");
