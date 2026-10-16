import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ROLES, type Rol } from "@/data/demo";
import { useAppStore } from "@/lib/store";
import { pageHead } from "@/lib/seo";
import { Card, DemoBadge, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracion")({
  head: () => pageHead("Configuración", "Datos de la empresa, perfil del usuario, rol demostrativo y preferencias del prototipo AgroMatch COMEX."),
  component: Configuracion,
});

const inp = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

function Configuracion() {
  const { state, dispatch } = useAppStore();
  return (
    <div>
      <PageHeader titulo="Configuración" descripcion="Preferencias del prototipo. Los cambios de empresa y perfil son locales y demostrativos." acciones={<DemoBadge />} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-semibold">Empresa activa</h2>
          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); toast.success("Datos de empresa guardados (demo)"); }}>
            <L t="Razón social"><input className={inp} defaultValue="AgroExport NEA S.A. (demo)" /></L>
            <L t="CUIT"><input className={inp} defaultValue="30-00000000-0 (ficticio)" /></L>
            <L t="Provincia"><input className={inp} defaultValue="Chaco" /></L>
            <L t="Moneda preferida"><select className={inp}><option>USD</option><option>ARS</option></select></L>
            <Button type="submit" className="col-span-2">Guardar</Button>
          </form>
        </Card>
        <Card>
          <h2 className="mb-4 text-base font-semibold">Rol demostrativo</h2>
          <div className="space-y-2">
            {ROLES.map((r) => (
              <button key={r.id} onClick={() => { dispatch({ type: "setRol", rol: r.id as Rol }); toast.success(`Rol: ${r.label}`); }} className={cn("w-full rounded-lg border p-3 text-left", state.rol === r.id ? "border-primary bg-accent" : "border-border hover:bg-accent/60")}>
                <p className="text-sm font-semibold">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.descripcion}</p>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Datos del prototipo</h2>
          <p className="mb-4 text-sm text-muted-foreground">Los cambios se guardan en este navegador. Podés volver al estado inicial de la demostración.</p>
          <Button variant="outline" onClick={() => { dispatch({ type: "reset" }); toast.success("Datos de demostración restablecidos"); }}>Restablecer datos demo</Button>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">Integraciones futuras</h2>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {["Entidades bancarias", "Aduana / ARCA", "SENASA", "Stellar / Soroban"].map((i) => <li key={i} className="flex justify-between"><span>{i}</span><span className="text-xs font-medium">Próximamente</span></li>)}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">{t}</span>{children}</label>;
}
