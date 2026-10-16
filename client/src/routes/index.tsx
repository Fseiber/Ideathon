import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, CheckCircle2, Layers, LockKeyhole, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { centsToUsd, getLots, getOrders } from "@/lib/api";
import { computeKpis } from "@/lib/dashboard";
import { Card, PageHeader, StatCard, StatusBadge } from "@/components/ui-kit";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — AgroFlow" }, { name: "description", content: "Indicadores reales de lotes tokenizados y órdenes en Stellar testnet." }] }),
  component: Dashboard,
});

function Dashboard() {
  const lotsQuery = useQuery({ queryKey: ["lots"], queryFn: getLots });
  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: () => getOrders(2) });
  const unavailable = lotsQuery.isError || ordersQuery.isError;
  const ready = Boolean(lotsQuery.data && ordersQuery.data);
  const kpis = ready ? computeKpis(lotsQuery.data ?? [], ordersQuery.data ?? []) : null;
  const latestOrders = [...(ordersQuery.data ?? [])].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 5);

  return <div>
    <PageHeader titulo="Dashboard" descripcion="Actividad real de lotes y órdenes en Stellar testnet." acciones={<StatusBadge tono="success">Testnet</StatusBadge>} />
    {unavailable && <p className="mb-4 rounded-lg border border-warning/40 bg-warning-muted/50 p-3 text-sm text-warning-foreground">Backend no disponible — los indicadores reales no pudieron cargarse.</p>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard titulo="Toneladas disponibles" valor={kpis ? `${kpis.tonsAvailable} tn` : "—"} icono={<Package className="h-5 w-5" />} tono="info" />
      <StatCard titulo="Toneladas tokenizadas" valor={kpis ? `${kpis.tonsTokenized} tn` : "—"} icono={<Layers className="h-5 w-5" />} tono="success" />
      <StatCard titulo="Órdenes activas" valor={kpis?.activeOrders ?? "—"} icono={<Activity className="h-5 w-5" />} tono="info" />
      <StatCard titulo="Escrow retenido" valor={kpis ? `${centsToUsd(kpis.escrowCents).toLocaleString("es-AR")} USDC de prueba` : "—"} icono={<LockKeyhole className="h-5 w-5" />} tono="warning" />
      <StatCard titulo="Completadas / liquidado" valor={kpis ? <><span>{kpis.completedOrders}</span><span className="ml-2 text-sm font-medium">· {centsToUsd(kpis.settledCents).toLocaleString("es-AR")} USDC de prueba</span></> : "—"} icono={<CheckCircle2 className="h-5 w-5" />} tono="success" />
    </div>
    <Card className="mt-6">
      <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Últimas operaciones</h2><p className="text-xs text-muted-foreground">Órdenes reales más recientes del backend.</p></div><Link to="/operaciones" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Ver operaciones <ArrowRight className="h-3 w-3" /></Link></div>
      {latestOrders.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="pb-2 pr-3">Orden</th><th className="pb-2 pr-3">Destino</th><th className="pb-2 pr-3">Toneladas</th><th className="pb-2 pr-3">Total</th><th className="pb-2">Estado</th></tr></thead><tbody>{latestOrders.map((order) => <tr key={order.id} className="border-b border-border/60 last:border-0"><td className="py-3 pr-3 font-mono text-xs">#{order.id}</td><td className="pr-3">{order.destination}</td><td className="pr-3">{order.tons} tn</td><td className="pr-3">{centsToUsd(order.totalCents).toLocaleString("es-AR")} USDC de prueba</td><td><StatusBadge tono={order.status === "COMPLETADA" ? "success" : "info"}>{order.status}</StatusBadge></td></tr>)}</tbody></table></div> : <p className="py-6 text-center text-sm text-muted-foreground">{ready ? "Todavía no hay órdenes reales." : "—"}</p>}
    </Card>
  </div>;
}
