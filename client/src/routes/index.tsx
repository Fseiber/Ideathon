import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  FilePlus2,
  Files,
  Package,
  Scale,
  Search,
  Sparkles,
  Truck,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { OPORTUNIDADES_POR_PAIS, ROLES, fmtTn, fmtUsd } from "@/data/demo";
import { useAppStore } from "@/lib/store";
import { Card, DemoBadge, PageHeader, StatCard, StatusBadge, tonoEstado } from "@/components/ui-kit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — AgroMatch COMEX" },
      {
        name: "description",
        content:
          "Panel principal de AgroMatch COMEX: indicadores comerciales, oportunidades por país, solicitudes recientes, operaciones en seguimiento y alertas documentales. Prototipo demo.",
      },
      { property: "og:title", content: "Dashboard — AgroMatch COMEX" },
      {
        property: "og:description",
        content: "Indicadores comerciales y seguimiento de operaciones de exportación agroindustrial (demo).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { state } = useAppStore();
  const rol = ROLES.find((r) => r.id === state.rol)!;

  const productosDisponibles = state.productos.filter((p) => p.estado === "Disponible").length;
  const solicitudesActivas = state.solicitudes.filter((s) => s.estado === "Activa").length;
  const cotizacionesPendientes = state.cotizaciones.filter((c) =>
    ["Borrador", "Enviada", "En negociación"].includes(c.estado),
  ).length;
  const operacionesEnCurso = state.operaciones.filter((o) => o.hitoActual < 7).length;
  const conDiferencias = state.conciliaciones.filter((c) => c.estado === "Con diferencias").length;
  const oportunidades = state.solicitudes.length + state.productos.filter((p) => p.estado === "Disponible").length;

  return (
    <div>
      <PageHeader
        titulo="Dashboard comercial"
        descripcion={`Vista para: ${rol.label}. Indicadores calculados sobre los datos de demostración del prototipo — no representan cifras reales del comercio argentino.`}
        acciones={<DemoBadge />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard titulo="Productos disponibles" valor={productosDisponibles} icono={<Package className="h-5 w-5" />} tono="info" />
        <StatCard titulo="Solicitudes activas" valor={solicitudesActivas} icono={<FilePlus2 className="h-5 w-5" />} tono="info" />
        <StatCard titulo="Oportunidades compatibles" valor={oportunidades} icono={<Sparkles className="h-5 w-5" />} tono="success" />
        <StatCard titulo="Cotizaciones pendientes" valor={cotizacionesPendientes} icono={<Files className="h-5 w-5" />} tono="warning" />
        <StatCard titulo="Operaciones en curso" valor={operacionesEnCurso} icono={<Truck className="h-5 w-5" />} tono="info" />
        <StatCard titulo="Alertas documentales" valor={3 + conDiferencias} icono={<AlertTriangle className="h-5 w-5" />} tono="danger" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <h2 className="mb-1 text-base font-semibold">Oportunidades comerciales por país</h2>
          <p className="mb-4 text-xs text-muted-foreground">Datos ficticios de demostración</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={OPORTUNIDADES_POR_PAIS} margin={{ left: -20, right: 8, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="pais" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="oportunidades" name="Oportunidades" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <h2 className="mb-1 text-base font-semibold">Accesos rápidos</h2>
          <p className="mb-4 text-xs text-muted-foreground">Flujos principales del prototipo</p>
          <div className="space-y-2">
            {[
              { to: "/mis-productos", label: "Publicar producto", icon: Package },
              { to: "/marketplace", label: "Buscar compradores y lotes", icon: Search },
              { to: "/matching", label: "Ejecutar matching inteligente", icon: Sparkles },
              { to: "/calculadora", label: "Calcular exportación", icon: Calculator },
              { to: "/cotizaciones", label: "Generar cotización", icon: Files },
              { to: "/conciliacion", label: "Revisar conciliación", icon: Scale },
            ].map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Solicitudes de compra recientes</h2>
            <Link to="/solicitudes" className="text-xs font-medium text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">ID</th>
                  <th className="pb-2 pr-3 font-medium">Comprador</th>
                  <th className="pb-2 pr-3 font-medium">Producto</th>
                  <th className="pb-2 pr-3 font-medium">Volumen</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {state.solicitudes.slice(0, 4).map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 font-mono text-xs">{s.id}</td>
                    <td className="py-2.5 pr-3">{s.comprador}</td>
                    <td className="py-2.5 pr-3">
                      {s.tipoArroz} {s.variedad}
                    </td>
                    <td className="py-2.5 pr-3">{fmtTn(s.volumenTn)}</td>
                    <td className="py-2.5">
                      <StatusBadge tono={tonoEstado(s.estado)}>{s.estado}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Operaciones en seguimiento</h2>
            <Link to="/operaciones" className="text-xs font-medium text-primary hover:underline">
              Ver operaciones
            </Link>
          </div>
          <div className="space-y-3">
            {state.operaciones.map((op) => (
              <div key={op.id} className="rounded-lg border border-border p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs font-semibold">{op.id}</p>
                  <StatusBadge tono={tonoEstado(op.estadoLogistico)}>{op.estadoLogistico}</StatusBadge>
                </div>
                <p className="mt-1 text-sm">
                  {op.producto} · {fmtTn(op.cantidadContratadaTn)} · {fmtUsd(op.valorFacturadoUsd || op.cantidadContratadaTn * op.precioPactadoTnUsd)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {op.puertoSalida} → {op.puertoDestino} · {op.incoterm}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-success" style={{ width: `${(op.hitoActual / 7) * 100}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Hito {op.hitoActual} de 7</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 border-warning/40 bg-warning-muted/50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
          <div>
            <h2 className="text-sm font-semibold">Alertas de documentación pendiente</h2>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>OP-2026-017: permiso de embarque pendiente de presentación (demo).</li>
              <li>OP-2026-017: certificado fitosanitario en preparación, vence el 30/10/2026.</li>
              <li>OP-2026-014: diferencia de USD 150 en conciliación — identificar comprobante de comisión exterior.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
