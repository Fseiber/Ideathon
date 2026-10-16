import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import {
  CONCILIACIONES_INICIALES,
  COTIZACIONES_INICIALES,
  OPERACIONES_INICIALES,
  PRODUCTOS_INICIALES,
  SOLICITUDES_INICIALES,
  type Conciliacion,
  type Cotizacion,
  type Operacion,
  type Producto,
  type Rol,
  type SolicitudCompra,
} from "@/data/demo";

export interface AppState {
  rol: Rol;
  productos: Producto[];
  solicitudes: SolicitudCompra[];
  cotizaciones: Cotizacion[];
  operaciones: Operacion[];
  conciliaciones: Conciliacion[];
}

type Action =
  | { type: "setRol"; rol: Rol }
  | { type: "addProducto"; producto: Producto }
  | { type: "removeProducto"; id: string }
  | { type: "addSolicitud"; solicitud: SolicitudCompra }
  | { type: "addCotizacion"; cotizacion: Cotizacion }
  | { type: "updateCotizacion"; id: string; patch: Partial<Cotizacion> }
  | { type: "addOperacion"; operacion: Operacion }
  | { type: "updateOperacion"; id: string; patch: Partial<Operacion> }
  | { type: "addConciliacion"; conciliacion: Conciliacion }
  | { type: "reset" };

const initialState: AppState = {
  rol: "exportador",
  productos: PRODUCTOS_INICIALES,
  solicitudes: SOLICITUDES_INICIALES,
  cotizaciones: COTIZACIONES_INICIALES,
  operaciones: OPERACIONES_INICIALES,
  conciliaciones: CONCILIACIONES_INICIALES,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "setRol":
      return { ...state, rol: action.rol };
    case "addProducto":
      return { ...state, productos: [action.producto, ...state.productos] };
    case "removeProducto":
      return { ...state, productos: state.productos.filter((p) => p.id !== action.id) };
    case "addSolicitud":
      return { ...state, solicitudes: [action.solicitud, ...state.solicitudes] };
    case "addCotizacion":
      return { ...state, cotizaciones: [action.cotizacion, ...state.cotizaciones] };
    case "updateCotizacion":
      return {
        ...state,
        cotizaciones: state.cotizaciones.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
    case "addOperacion":
      return { ...state, operaciones: [action.operacion, ...state.operaciones] };
    case "updateOperacion":
      return {
        ...state,
        operaciones: state.operaciones.map((o) => (o.id === action.id ? { ...o, ...action.patch } : o)),
      };
    case "addConciliacion":
      return { ...state, conciliaciones: [action.conciliacion, ...state.conciliaciones] };
    case "reset":
      return initialState;
    default:
      return state;
  }
}

const STORAGE_KEY = "agromatch-comex-demo-v4";

function loadState(): AppState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.productos || !parsed.cotizaciones) return initialState;
    return parsed;
  } catch {
    return initialState;
  }
}

const StoreContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // almacenamiento no disponible: el prototipo sigue funcionando en memoria
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useAppStore debe usarse dentro de AppStoreProvider");
  return ctx;
}
