import { useNavigate } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { comexClient, login as loginRequest, type ComexClient, type ComexUser } from "./comex-api";

// Sesión de usuarios internos COMEX: token en memoria + sessionStorage (se pierde al cerrar la pestaña).
const STORAGE_KEY = "agroflow.comex.session";

type Stored = { token: string; user: ComexUser };
type AuthValue = {
  ready: boolean;
  user: ComexUser | null;
  token: string | null;
  client: ComexClient;
  login: (email: string, password: string) => Promise<ComexUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function readStored(): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return typeof parsed?.token === "string" && parsed.user ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(value: Stored | null) {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // almacenamiento no disponible: la sesión queda sólo en memoria
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Stored | null>(null);
  const [ready, setReady] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const apply = useCallback((value: Stored | null) => {
    tokenRef.current = value?.token ?? null;
    writeStored(value);
    setSession(value);
  }, []);

  const onUnauthorized = useCallback(() => {
    apply(null);
    void navigate({ to: "/comex/login" });
  }, [apply, navigate]);

  const client = useMemo(() => comexClient({ get token() { return tokenRef.current; }, onUnauthorized }), [onUnauthorized]);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      tokenRef.current = stored.token;
      setSession(stored);
      client.me().then((user) => apply({ token: stored.token, user })).catch(() => { /* 401 ya limpió la sesión */ });
    }
    setReady(true);
  }, [apply, client]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    apply({ token: result.token, user: result.user });
    return result.user;
  }, [apply]);

  const logout = useCallback(async () => {
    try { if (tokenRef.current) await client.logout(); } catch { /* la sesión local se limpia igual */ }
    apply(null);
  }, [apply, client]);

  const value = useMemo<AuthValue>(() => ({ ready, user: session?.user ?? null, token: session?.token ?? null, client, login, logout }), [ready, session, client, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}

// Guard de rutas COMEX: sin sesión redirige a /comex/login.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && !user) void navigate({ to: "/comex/login" });
  }, [ready, user, navigate]);
  if (!ready || !user) return <p className="p-6 text-sm text-muted-foreground">Verificando sesión…</p>;
  return <>{children}</>;
}
