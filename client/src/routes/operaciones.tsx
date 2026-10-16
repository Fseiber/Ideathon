import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { HITOS_OPERACION, fmtTn, fmtUsd, type Operacion } from "@/data/demo";
import { useAppStore } from "@/lib/store";
import { pageHead } from "@/lib/seo";
import { Card, DemoBadge, PageHeader, StatusBadge, tonoEstado } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { RealOrdersTable } from "@/components/real-orders-table";

export const Route = createFileRoute("/operaciones")({
  head: () => pageHead("Operaciones y embarques", "Seguimiento de operaciones comerciales aceptadas: cantidades, estados documental, logístico y financiero, y timeline de hitos (demo)."),
  component: Operaciones,
});

const ESTADO_POR_HITO = ["Cotización aceptada", "Documentación en preparación", "Mercadería preparada", "Embarque realizado", "Documentos presentados", "Pago recibido", "Conciliación realizada"];

function Operaciones() {
  const { state, dispatch } = useAppStore();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const op = state.operaciones.find((o) => o.id === sel) ?? null;
  const lista = state.operaciones.filter((o) => !q || `${o.id} ${o.comprador} ${o.producto}`.toLowerCase().includes(q.toLowerCase()));

  const avanzar = (o: Operacion) => {
    if (o.hitoActual >= 7) return;
    const h = o.hitoActual + 1;
    const patch: Partial<Operacion> = { hitoActual: h, estadoLogistico: ESTADO_POR_HITO[h - 1] ?? o.estadoLogistico };
    if (h >= 4) { patch.cantidadEmbarcadaTn = o.cantidadContratadaTn; patch.valorFacturadoUsd = o.cantidadContratadaTn * o.precioPactadoTnUsd; patch.permisoEmbarque = o.permisoEmbarque ?? `PE-${o.id.slice(-3)}-DEMO`; }
    if (h >= 5) patch.estadoDocumental = "Presentado";
    if (h >= 6) patch.estadoFinanciero = "Cobro recibido";
    if (h === 6 && !state.conciliaciones.some((c) => c.operacionId === o.id)) {
      const total = o.cantidadContratadaTn * o.precioPactadoTnUsd;
      dispatch({ type: "addConciliacion", conciliacion: {
        id: `CONC-${String(state.conciliaciones.length + 1).padStart(3, "0")}`, operacionId: o.id, facturaUsd: total, valorEmbarcadoUsd: total,
        ordenPagoUsd: total, cobroBrutoUsd: total, comisionesDeclaradasUsd: 150, cobroNetoUsd: total - 150, anticiposUsd: 0,
        estado: "Con diferencias", observacion: "Cobro de ejemplo con USD 150 de comisión del exterior. Identificar comprobante y verificar tratamiento.",
      } });
      toast.info("Se registró un cobro de ejemplo en Conciliación financiera");
    }
    if (h === 7) patch.estadoFinanciero = "Conciliado";
    dispatch({ type: "updateOperacion", id: o.id, patch });
    toast.success(`${o.id}: ${ESTADO_POR_HITO[h - 1]}`);
  };

  return (
    <div>
       <PageHeader titulo="Operaciones" descripcion="Órdenes reales y liquidaciones en Stellar testnet." />
       <RealOrdersTable />
       {!showDemo && <Button variant="ghost" size="sm" onClick={() => setShowDemo(true)}>Ver operaciones de ejemplo (demo)</Button>}
       {showDemo && <>
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Operaciones de ejemplo (demo)</h2><DemoBadge /></div>
      <Card>
        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar operación…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground">
              {["ID", "Comprador", "Producto", "Contratado", "Embarcado", "Precio/tn", "Facturado", "Incoterm", "Ruta", "Documental", "Logístico", "Financiero", ""].map((h) => <th key={h} className="pb-2 pr-3 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>{lista.map((o) => (
              <tr key={o.id} className="border-b border-border/60">
                <td className="py-3 pr-3 font-mono text-xs">{o.id}</td>
                <td className="pr-3">{o.comprador}</td>
                <td className="pr-3">{o.producto}</td>
                <td className="pr-3">{fmtTn(o.cantidadContratadaTn)}</td>
                <td className="pr-3">{fmtTn(o.cantidadEmbarcadaTn)}</td>
                <td className="pr-3">{fmtUsd(o.precioPactadoTnUsd)}</td>
                <td className="pr-3">{o.valorFacturadoUsd ? fmtUsd(o.valorFacturadoUsd) : "—"}</td>
                <td className="pr-3">{o.incoterm}</td>
                <td className="pr-3 text-xs">{o.puertoSalida} → {o.puertoDestino}</td>
                <td className="pr-3"><StatusBadge tono={tonoEstado(o.estadoDocumental)}>{o.estadoDocumental}</StatusBadge></td>
                <td className="pr-3"><StatusBadge tono="info">{o.estadoLogistico}</StatusBadge></td>
                <td className="pr-3"><StatusBadge tono={tonoEstado(o.estadoFinanciero)}>{o.estadoFinanciero}</StatusBadge></td>
                <td><Button size="sm" variant="outline" onClick={() => setSel(o.id)}>Detalle</Button></td>
              </tr>))}</tbody>
          </table>
        </div>
      </Card>

      <Sheet open={!!op} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {op && (
            <>
              <SheetHeader>
                <SheetTitle>Operación {op.id}</SheetTitle>
                <SheetDescription>{op.comprador} · {op.producto}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <F k="Vendedor" v={op.vendedor} /><F k="Fecha programada" v={op.fechaProgramada} />
                <F k="Puerto de salida" v={op.puertoSalida} /><F k="Puerto de destino" v={op.puertoDestino} />
                <F k="Permiso de embarque" v={op.permisoEmbarque ?? "Sin asignar"} /><F k="Valor contratado" v={fmtUsd(op.cantidadContratadaTn * op.precioPactadoTnUsd)} />
              </div>
              <h3 className="mb-3 mt-6 text-sm font-semibold">Timeline de la operación</h3>
              <ol className="relative space-y-4 border-l-2 border-border pl-6">
                {HITOS_OPERACION.map((h, i) => {
                  const n = i + 1;
                  const hecho = n <= op.hitoActual;
                  return (
                    <li key={h} className="relative">
                      <span className={cn("absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full border-2", hecho ? "border-success bg-success text-success-foreground" : "border-border bg-card")}>{hecho && <Check className="h-3 w-3" />}</span>
                      <p className={cn("text-sm", hecho ? "font-semibold" : "text-muted-foreground")}>{n}. {h}</p>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button disabled={op.hitoActual >= 7} onClick={() => avanzar(op)}>Avanzar al siguiente hito</Button>
                <Button variant="outline" asChild><Link to="/documentacion">Ver documentos</Link></Button>
                <Button variant="outline" asChild><Link to="/conciliacion">Ver conciliación</Link></Button>
                <Button variant="outline" asChild><Link to="/trazabilidad" search={{ op: op.id }}>Expediente</Link></Button>
              </div>
            </>
          )}
        </SheetContent>
       </Sheet></>}
    </div>
  );
}

function F({ k, v }: { k: string; v: string }) {
  return <div><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium">{v}</p></div>;
}
