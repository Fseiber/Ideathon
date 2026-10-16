import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Blocks, FileCheck2, History } from "lucide-react";
import { useEffect, useState } from "react";

import { fmtTn, type Operacion } from "@/data/demo";
import { Card, DemoBadge, PageHeader, StatusBadge } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlockchainPanel } from "@/components/blockchain-panel";
import { getOrder, getOrders, type ApiOrder } from "@/lib/api";
import { EVENT_LABEL, parseSelectId, STATUS_LABEL, toSelectId } from "@/lib/order-view";
import { useAppStore } from "@/lib/store";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/trazabilidad")({
  validateSearch: (s: Record<string, unknown>): { op?: string } => {
    const search: { op?: string } = {};
    if (typeof s["op"] === "string") search.op = s["op"];
    return search;
  },
  head: () => pageHead("Trazabilidad", "Expediente digital de lotes y operaciones con historial y evidencias, y pantalla de verificación blockchain preparada para Stellar Testnet."),
  component: Trazabilidad,
});

function Trazabilidad() {
  const { state } = useAppStore();
  const { op: opInicial } = Route.useSearch();
  const [selectedId, setSelectedId] = useState(opInicial ?? state.operaciones[0]?.id ?? "");
  const selected = parseSelectId(selectedId);
  const realOrdersQuery = useQuery({ queryKey: ["orders"], queryFn: () => getOrders(2) });
  const realOrders = realOrdersQuery.data ?? [];
  const realOrderQuery = useQuery({
    queryKey: ["order", selected.id],
    queryFn: () => getOrder(selected.id, 2),
    enabled: selected.kind === "real",
  });
  const backendUnavailable = realOrdersQuery.isError;
  const viewSelection = backendUnavailable && selected.kind === "real" ? { kind: "demo" as const, id: state.operaciones[0]?.id ?? "" } : selected;
  const demoOperation = viewSelection.kind === "demo" ? state.operaciones.find((operation) => operation.id === viewSelection.id) : undefined;
  const realOrder = viewSelection.kind === "real" ? realOrderQuery.data ?? realOrders.find((order) => order.id === viewSelection.id) : undefined;

  useEffect(() => {
    if (!opInicial) {
      const firstCompleted = realOrders.find((order) => order.status === "COMPLETADA");
      if (firstCompleted && state.operaciones.some((operation) => operation.id === selectedId)) setSelectedId(toSelectId(firstCompleted.id));
    }
  }, [opInicial, realOrders, selectedId, state.operaciones]);

  const loadingRealOrder = viewSelection.kind === "real" && realOrderQuery.isPending && !realOrder;

  return (
    <div>
      <PageHeader titulo="Trazabilidad digital" descripcion="Expediente de cada operación con documentos, confirmaciones e historial." acciones={<DemoBadge />} />
      {backendUnavailable && <p className="mb-4 rounded-lg border border-warning/40 bg-warning-muted/50 p-3 text-sm text-warning-foreground">Backend no disponible — mostrando solo datos demo</p>}
      <Card className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Operación:</span>
        {realOrdersQuery.isPending && <Skeleton className="h-9 w-72" />}
        <select value={viewSelection.kind === "real" ? toSelectId(viewSelection.id) : viewSelection.id} onChange={(event) => setSelectedId(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {realOrders.length > 0 && <optgroup label="Testnet (real)">{realOrders.map((order) => <option key={order.id} value={toSelectId(order.id)}>#{order.id} — {order.tons} tn {order.destination} · {STATUS_LABEL[order.status]}</option>)}</optgroup>}
          <optgroup label="Demo">{state.operaciones.map((operation) => <option key={operation.id} value={operation.id}>{operation.id} — {operation.comprador}</option>)}</optgroup>
        </select>
      </Card>

      {loadingRealOrder && <Skeleton className="h-64 w-full" />}
      {realOrder && <RealOrderView order={realOrder} />}
      {demoOperation && <DemoOrderView operation={demoOperation} />}
      {viewSelection.kind === "real" && !realOrder && !loadingRealOrder && <Card><p className="text-sm text-muted-foreground">No se pudo cargar la orden real seleccionada.</p></Card>}
    </div>
  );
}

function RealOrderView({ order }: { order: ApiOrder }) {
  return (
    <Tabs defaultValue="expediente">
      <TabsList>
        <TabsTrigger value="expediente">Expediente</TabsTrigger>
        <TabsTrigger value="blockchain">Verificación blockchain</TabsTrigger>
      </TabsList>
      <TabsContent value="expediente" className="mt-4">
        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <h3 className="mb-3 text-sm font-semibold">Datos del lote</h3>
            <dl className="space-y-2 text-sm">
              <RealField label="Identificador de lote" value={String(order.lotId)} />
              <RealField label="Cantidad" value={fmtTn(order.tons)} />
              <RealField label="Destino" value={order.destination} />
              <RealField label="Incoterm" value={`${order.incoterm} · ${STATUS_LABEL[order.status]}`} />
            </dl>
          </Card>
          <Card className="xl:col-span-2">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-info" />Historial de cambios</h3>
            <ol className="space-y-3 border-l-2 border-border pl-4">
              {order.events.map((event) => <li key={`${event.type}-${event.createdAt}`}><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("es-AR")}</p><p className="text-sm">{EVENT_LABEL[event.type]}</p></li>)}
            </ol>
          </Card>
        </div>
      </TabsContent>
      <TabsContent value="blockchain" className="mt-4"><BlockchainPanel order={order} /></TabsContent>
    </Tabs>
  );
}

function RealField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>;
}

function DemoOrderView({ operation: op }: { operation: Operacion }) {
  const historial = [
    { fecha: "2026-09-01", evento: "Cotización aceptada por el comprador", actor: op.comprador },
    { fecha: "2026-09-05", evento: "Análisis de calidad cargado (quebrado, humedad)", actor: "Laboratorio (demo)" },
    { fecha: "2026-09-12", evento: "Lote asignado y precintado", actor: op.vendedor },
    ...(op.hitoActual >= 4 ? [{ fecha: op.fechaProgramada, evento: `Embarque realizado en ${op.puertoSalida}`, actor: "Naviera (demo)" }] : []),
    ...(op.hitoActual >= 6 ? [{ fecha: "2026-10-10", evento: "Cobro registrado — diferencia por comisión en revisión", actor: "Exportador" }] : []),
  ];

  return (
    <Tabs defaultValue="expediente">
      <TabsList><TabsTrigger value="expediente">Expediente</TabsTrigger><TabsTrigger value="blockchain">Verificación blockchain</TabsTrigger></TabsList>
      <TabsContent value="expediente" className="mt-4">
        <div className="grid gap-6 xl:grid-cols-3">
          <Card>
            <h3 className="mb-3 text-sm font-semibold">Datos del lote</h3>
            <dl className="space-y-2 text-sm">
              {[['Identificador de lote', `LT-${op.id.slice(-3)}-DEMO`], ['Proveedor', op.vendedor], ['Comprador', op.comprador], ['Producto', op.producto], ['Cantidad', fmtTn(op.cantidadContratadaTn)], ['Características', 'Quebrado ≤ 5% · Humedad ≤ 13% (según análisis demo)']].map(([key, value]) => <div key={key}><dt className="text-xs text-muted-foreground">{key}</dt><dd className="font-medium">{value}</dd></div>)}
            </dl>
          </Card>
          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileCheck2 className="h-4 w-4 text-success" />Documentos y confirmaciones</h3>
            <ul className="space-y-2 text-sm">{["Factura comercial", "Análisis de calidad", "Certificado fitosanitario", "Packing list", "Bill of Lading"].map((document, index) => <li key={document} className="flex items-center justify-between"><span>{document}</span><StatusBadge tono={index < op.hitoActual - 1 ? "success" : "warning"}>{index < op.hitoActual - 1 ? "Confirmado" : "Pendiente"}</StatusBadge></li>)}</ul>
          </Card>
          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-info" />Historial de cambios</h3>
            <ol className="space-y-3 border-l-2 border-border pl-4">{historial.map((entry, index) => <li key={index}><p className="text-xs text-muted-foreground">{entry.fecha} · {entry.actor}</p><p className="text-sm">{entry.evento}</p></li>)}</ol>
          </Card>
        </div>
      </TabsContent>
      <TabsContent value="blockchain" className="mt-4">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-base font-semibold"><Blocks className="h-5 w-5 text-primary" />Verificación blockchain</h3><DemoBadge /></div>
          <p className="mb-4 rounded-lg border border-info/30 bg-info-muted/50 p-3 text-sm text-muted-foreground">Escrow custodial en Stellar testnet. Soroban y multifirma: hoja de ruta.</p>
          <div className="grid gap-3 md:grid-cols-2">{[["Red", "Stellar Testnet"], ["Estado de conexión", "Sin conexión"], ["Cuenta del usuario", "Pendiente de integración"], ["Hash de transacción", "— (sin registro)"], ["Fecha de registro", "—"], ["Estado de verificación", "No verificado — pendiente de integración"]].map(([key, value]) => <div key={key} className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{key}</p><p className="font-mono text-sm">{value}</p></div>)}</div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
