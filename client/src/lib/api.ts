export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export type Party = 1 | 2;

export function partyFromRol(rol: "productor" | "comprador" | "exportador"): Party | null {
  if (rol === "productor") return 1;
  if (rol === "comprador") return 2;
  return null;
}

type ApiOptions = {
  method?: "GET" | "POST";
  party?: Party;
  body?: unknown;
};

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method || "GET";
  const headers = new Headers();
  const party = opts.party ?? (method === "GET" ? 1 : undefined);
  if (party !== undefined) headers.set("x-party-id", String(party));
  if (opts.body !== undefined) headers.set("content-type", "application/json");

  let response: Response;
  try {
    const request: RequestInit = { method, headers };
    if (opts.body !== undefined) request.body = JSON.stringify(opts.body);
    response = await fetch(`/api${path}`, request);
  } catch {
    throw new ApiError("NETWORK_ERROR", "No se pudo conectar con el backend", 0);
  }

  if (!response.ok) {
    try {
      const payload: unknown = await response.json();
      if (isApiErrorPayload(payload)) {
        throw new ApiError(payload.error.code, payload.error.message, response.status);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
    }
    throw new ApiError("NETWORK_ERROR", "El backend devolvió una respuesta inválida", response.status);
  }

  return (await response.json()) as T;
}

function isApiErrorPayload(value: unknown): value is { error: { code: string; message: string } } {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = value.error;
  return typeof error === "object" && error !== null && "code" in error && "message" in error && typeof error.code === "string" && typeof error.message === "string";
}

export const centsToUsd = (c: number) => c / 100;
export const stellarTxUrl = (h: string) => `https://stellar.expert/explorer/testnet/tx/${h}`;
export const shortHash = (h: string) => h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-8)}` : h;

export type OrderStatus = "COTIZADA" | "PROCESANDO" | "FONDEADA" | "DESPACHADA" | "COMPLETADA";
export type EventType = "FUND_ESCROW" | "LOCK_TOKENS" | "RELEASE_ADVANCE" | "DISPATCHED" | "SETTLE_DVP" | "SEAL_HEDERA" | "SEAL_ERROR" | "ERROR";

export interface ApiEvent {
  type: EventType;
  txHash: string | null;
  explorerUrl: string | null;
  note: string | null;
  createdAt: string;
}

export interface ApiSeal {
  hash: string;
  topicId: string;
  sequenceNumber: number;
  hashscanUrl: string;
  mode: string;
}

export interface ApiOrder {
  id: string;
  status: OrderStatus;
  lotId: number;
  tokenCode: "ARROZ";
  destination: string;
  tons: number;
  incoterm: "FOB" | "CFR";
  subtotalCents: number;
  freightCents: number;
  totalCents: number;
  advanceCents: number;
  balanceCents: number;
  events: ApiEvent[];
  seal: ApiSeal | null;
}

export interface ApiLot {
  id: number;
  product: string;
  tonsTotal: number;
  tonsAvailable: number;
  mintTxHash: string;
  explorerUrl: string | null;
  createdAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  order: ApiOrder | null;
  agent: "gemini" | "stub";
}

export interface HealthResponse {
  ok: boolean;
  stellarMode: string;
  hederaMode: string;
  agentMode: string;
  db: string;
  issuerPublic: string | null;
  escrowPublic: string | null;
}

export const getHealth = () => api<HealthResponse>("/health");
export const getOrders = (party: Party) => api<ApiOrder[]>("/orders", { party });
export const getOrder = (id: string, party: Party) => api<ApiOrder>(`/orders/${id}`, { party });
export const verifyOrder = (id: string) => api<unknown>(`/orders/${id}/verify`);
export const fundOrder = (id: string) => api<ApiOrder>(`/orders/${id}/fund`, { method: "POST", party: 2 });
export const dispatchOrder = (id: string) => api<ApiOrder>(`/orders/${id}/dispatch`, { method: "POST", party: 1 });
export const confirmDelivery = (id: string) => api<ApiOrder>(`/orders/${id}/confirm-delivery`, { method: "POST", party: 2 });
export const sealOrder = (id: string) => api<ApiOrder>(`/orders/${id}/seal`, { method: "POST" });
export const getLots = () => api<ApiLot[]>("/lots");
export const sendChat = (messages: ChatMessage[]) => api<ChatResponse>("/chat", { method: "POST", party: 2, body: { messages } });
