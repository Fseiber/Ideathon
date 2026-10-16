import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, LogIn, LogOut, Users } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { canManageUsers } from "@/lib/comex-api";
import { cn } from "@/lib/utils";

const itemClass = (active: boolean) => cn("flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors", active ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground");

// Grupo "COMEX" del sidebar: directorio de empresas, usuarios (sólo ADMIN) y estado de sesión.
export function ComexNav({ pathname }: { pathname: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="pt-3">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/45">COMEX</p>
      <Link to="/comex/empresas" className={itemClass(pathname.startsWith("/comex/empresas"))}><Building2 className="h-4 w-4 shrink-0" /><span className="flex-1">Empresas</span></Link>
      {canManageUsers(user) && <Link to="/comex/usuarios" className={itemClass(pathname.startsWith("/comex/usuarios"))}><Users className="h-4 w-4 shrink-0" /><span className="flex-1">Usuarios</span></Link>}
      {user ? (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-sidebar-foreground/70">
          <span className="flex-1 truncate">Sesión: {user.name}</span>
          <button type="button" className="inline-flex items-center gap-1 hover:text-sidebar-accent-foreground" onClick={async () => { await logout(); await navigate({ to: "/comex/login" }); }}><LogOut className="h-3 w-3" />Salir</button>
        </div>
      ) : (
        <Link to="/comex/login" className={itemClass(pathname.startsWith("/comex/login"))}><LogIn className="h-4 w-4 shrink-0" /><span className="flex-1">Iniciar sesión</span></Link>
      )}
    </div>
  );
}
