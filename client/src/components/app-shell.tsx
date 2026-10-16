import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  Calculator,
  ChevronDown,
  LayoutDashboard,
  MessageSquare,
  Package,
  RefreshCcw,
  Scale,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Sprout,
  Truck,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { ROLES, type Rol } from "@/data/demo";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ChatAssistantProvider, useChatAssistant } from "@/components/chat-assistant";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const PRIMARY_NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/marketplace", label: "Marketplace", icon: ShoppingCart },
  { to: "/mis-productos", label: "Mis lotes", icon: Package },
  { to: "/operaciones", label: "Operaciones", icon: Truck },
  { to: "/trazabilidad", label: "Verificación Stellar", icon: Waypoints },
];

const ROADMAP_NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/matching", label: "Matching avanzado", icon: Sparkles },
  { to: "/calculadora", label: "Calculadora COMEX completa", icon: Calculator },
  { to: "/documentacion", label: "Documentación internacional", icon: Package },
  { to: "/conciliacion", label: "Conciliación SECOEXPO", icon: Scale },
];

function NavItem({ item, pathname }: { item: { to: string; label: string; icon: LucideIcon }; pathname: string }) {
  const Icon = item.icon;
  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
  return <Link to={item.to} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", active ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")}><Icon className="h-4 w-4 shrink-0" />{item.label}</Link>;
}

export function AppShell({ children }: { children: ReactNode }) {
  return <ChatAssistantProvider><AppShellContent>{children}</AppShellContent></ChatAssistantProvider>;
}

function AppShellContent({ children }: { children: ReactNode }) {
  const { state, dispatch } = useAppStore();
  const { open } = useChatAssistant();
  const location = useLocation();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState("");

  const rolActual = ROLES.find((r) => r.id === state.rol)!;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Sprout className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
           <p className="font-display text-sm font-bold leading-tight">AgroFlow</p>
            <p className="text-[11px] text-sidebar-foreground/60">Prototipo demo · NEA TECH 2026</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 scrollbar-thin">
             {PRIMARY_NAV.slice(0, 3).map((item) => <NavItem key={item.to} item={item} pathname={location.pathname} />)}
             <AssistantNavItem open={open} />
             {PRIMARY_NAV.slice(3).map((item) => <NavItem key={item.to} item={item} pathname={location.pathname} />)}
             <Collapsible defaultOpen={false}>
             <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50 hover:bg-sidebar-accent/60"><span>Próximamente</span><ChevronDown className="h-3.5 w-3.5" /></CollapsibleTrigger>
             <CollapsibleContent className="space-y-0.5 pt-0.5">{ROADMAP_NAV.map((item) => <NavItem key={item.to} item={item} pathname={location.pathname} />)}</CollapsibleContent>
           </Collapsible>
           <NavItem item={{ to: "/configuracion", label: "Configuración", icon: Settings }} pathname={location.pathname} />
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">
            Rol demostrativo
          </p>
          <Select value={state.rol} onValueChange={(v) => dispatch({ type: "setRol", rol: v as Rol })}>
            <SelectTrigger className="w-full border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-[11px] leading-snug text-sidebar-foreground/50">{rolActual.descripcion}</p>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <Sprout className="h-5 w-5 text-primary" />
             <span className="font-display text-sm font-bold">AgroFlow</span>
          </Link>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && busqueda.trim()) {
                  toast.info(`Búsqueda general demo: "${busqueda}"`, {
                    description: "Usá los buscadores y filtros de cada sección para resultados reales del prototipo.",
                  });
                }
              }}
               placeholder="Buscar productos, lotes, operaciones…"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => open()} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent" aria-label="Asistente">
              <MessageSquare className="h-4 w-4" />
              <span>Asistente</span>
            </button>
            <button
              onClick={() =>
                toast.info("Notificaciones (demo)", {
                  description: "3 alertas documentales y 1 cotización pendiente de respuesta.",
                })
              }
              className="relative rounded-md p-2 text-muted-foreground hover:bg-accent"
              aria-label="Notificaciones"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning" />
            </button>
            <div className="hidden items-center gap-2 rounded-md border border-border px-3 py-1.5 sm:flex">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium">AgroExport NEA S.A. (demo)</span>
            </div>
            <button
              onClick={() => navigate({ to: "/configuracion" })}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
              aria-label="Perfil"
            >
              LI
            </button>
          </div>
        </header>

        {/* Nav móvil */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:hidden">
           {PRIMARY_NAV.slice(0, 3).map(({ to, label, icon: Icon }) => <Link key={to} to={to} className={cn("flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs", (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to)) ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-accent")}><Icon className="h-3.5 w-3.5" />{label}</Link>)}<button onClick={() => open()} className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent"><MessageSquare className="h-3.5 w-3.5" />Asistente IA</button>{PRIMARY_NAV.slice(3).map(({ to, label, icon: Icon }) => <Link key={to} to={to} className={cn("flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs", location.pathname.startsWith(to) ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-accent")}><Icon className="h-3.5 w-3.5" />{label}</Link>)}
        </nav>

        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>

        <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground lg:px-8">
          AgroFlow — Plataforma B2B en Stellar testnet · Ideathon NEA TECH 2026 ·{" "}
          <button
            className="inline-flex items-center gap-1 underline hover:text-foreground"
            onClick={() => {
              dispatch({ type: "reset" });
              toast.success("Datos de demostración restablecidos");
            }}
          >
            <RefreshCcw className="h-3 w-3" /> Restablecer datos demo
          </button>
        </footer>
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

function AssistantNavItem({ open }: { open: () => void }) {
  return <button onClick={() => open()} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"><MessageSquare className="h-4 w-4 shrink-0" />Asistente IA</button>;
}
