import { createFileRoute } from "@tanstack/react-router";
import { FileDown, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fmtTn, fmtUsd, type Cotizacion, type EstadoCotizacion } from "@/data/demo";
import { useAppStore } from "@/lib/store";
import { pageHead } from "@/lib/seo";
import { Card, DemoBadge, PageHeader, StatusBadge, tonoEstado } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export const Route = createFileRoute("/cotizaciones")({
  validateSearch: (s: Record<string, unknown>): { ver?: string } => {
    const out: { ver?: string } = {};
    if (typeof s["ver"] === "string") out.ver = s["ver"];
    return out;
  },
  head: () =>
    pageHead(
      "Cotizaciones",
      "Generador de cotizaciones comerciales internacionales con estados, margen editable, vista previa profesional y exportación a PDF (demo).",
    ),
  component: Cotizaciones,
});

const ESTADOS: EstadoCotizacion[] = ["Borrador", "Enviada", "En negociación", "Aceptada", "Rechazada"];

function Cotizaciones() {
  const { state, dispatch } = useAppStore();
  const { ver } = Route.useSearch();
  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [seleccionada, setSeleccionada] = useState<Cotizacion | null>(null);

  useEffect(() => {
    if (ver) {
      const c = state.cotizaciones.find((x) => x.id === ver);
      if (c) setSeleccionada(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver]);

  const lista = state.cotizaciones.filter(
    (c) => (!filtroEstado || c.estado === filtroEstado) && (!q || `${c.id} ${c.comprador} ${c.producto} ${c.paisDestino}`.toLowerCase().includes(q.toLowerCase())),
  );

  const cambiarEstado = (c: Cotizacion, estado: EstadoCotizacion) => {
    dispatch({ type: "updateCotizacion", id: c.id, patch: { estado } });
    setSeleccionada((s) => (s?.id === c.id ? { ...s, estado } : s));
    if (estado === "Aceptada") {
      const opId = `OP-2026-${String(state.operaciones.length + 20).padStart(3, "0")}`;
      dispatch({
        type: "addOperacion",
        operacion: {
          id: opId, comprador: c.comprador, vendedor: c.vendedor, producto: c.producto,
          cantidadContratadaTn: c.cantidadTn, cantidadEmbarcadaTn: 0, precioPactadoTnUsd: c.precioTnUsd,
          valorFacturadoUsd: 0, incoterm: c.incoterm, fechaProgramada: "2026-12-01",
          puertoSalida: c.lugarDesignado, puertoDestino: c.paisDestino,
          estadoDocumental: "En preparación", estadoLogistico: "Cotización aceptada", estadoFinanciero: "Pendiente de facturación", hitoActual: 1,
        },
      });
      toast.success(`Cotización aceptada: se creó la operación ${opId}`);
    } else {
      toast.success(`Cotización ${c.id} → ${estado}`);
    }
  };

  const recalcularMargen = (c: Cotizacion, margen: number) => {
    const base = c.precioTnUsd / (1 + c.margenPct / 100);
    const nuevo = +(base * (1 + margen / 100)).toFixed(2);
    dispatch({ type: "updateCotizacion", id: c.id, patch: { margenPct: margen, precioTnUsd: nuevo } });
    setSeleccionada({ ...c, margenPct: margen, precioTnUsd: nuevo });
  };

  return (
    <div>
      <PageHeader
        titulo="Cotizaciones comerciales"
        descripcion="Ofertas internacionales generadas desde la calculadora o cargadas de ejemplo. Aceptar una cotización crea la operación correspondiente."
        acciones={<DemoBadge />}
      />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por ID, comprador o producto…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" />
          </div>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground">
              {["ID", "Fecha", "Comprador", "Producto", "Cantidad", "Precio/tn", "Total", "Incoterm", "Validez", "Estado", ""].map((h) => <th key={h} className="pb-2 pr-3 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>{lista.map((c) => (
              <tr key={c.id} className="border-b border-border/60">
                <td className="py-3 pr-3 font-mono text-xs">{c.id}</td>
                <td className="pr-3 text-xs">{c.fecha}</td>
                <td className="pr-3">{c.comprador}</td>
                <td className="pr-3">{c.producto}</td>
                <td className="pr-3">{fmtTn(c.cantidadTn)}</td>
                <td className="pr-3">{fmtUsd(c.precioTnUsd, 2)}</td>
                <td className="pr-3 font-semibold">{fmtUsd(c.precioTnUsd * c.cantidadTn)}</td>
                <td className="pr-3">{c.incoterm}</td>
                <td className="pr-3 text-xs">{c.validezDias} días</td>
                <td className="pr-3"><StatusBadge tono={tonoEstado(c.estado)}>{c.estado}</StatusBadge></td>
                <td><Button size="sm" variant="outline" onClick={() => setSeleccionada(c)}>Ver</Button></td>
              </tr>))}</tbody>
          </table>
          {lista.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sin cotizaciones. Generala desde la calculadora COMEX.</p>}
        </div>
      </Card>

      <Dialog open={!!seleccionada} onOpenChange={(o) => !o && setSeleccionada(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {seleccionada && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                <div>
                  <p className="font-display text-lg font-bold">Cotización comercial internacional</p>
                  <p className="font-mono text-xs text-muted-foreground">{seleccionada.id} · {seleccionada.fecha}</p>
                </div>
                <StatusBadge tono={tonoEstado(seleccionada.estado)}>{seleccionada.estado}</StatusBadge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                <F k="Vendedor" v={seleccionada.vendedor} />
                <F k="Comprador" v={seleccionada.comprador} />
                <F k="País de destino" v={seleccionada.paisDestino} />
                <F k="Producto" v={seleccionada.producto} />
                <F k="Calidad" v={seleccionada.calidad} />
                <F k="Presentación" v={seleccionada.presentacion} />
                <F k="Cantidad" v={fmtTn(seleccionada.cantidadTn)} />
                <F k="Precio por tonelada" v={`${fmtUsd(seleccionada.precioTnUsd, 2)} ${seleccionada.moneda}`} />
                <F k="Precio total" v={fmtUsd(seleccionada.precioTnUsd * seleccionada.cantidadTn)} />
                <F k="Incoterm y lugar" v={`${seleccionada.incoterm} — ${seleccionada.lugarDesignado}`} />
                <F k="Moneda" v={seleccionada.moneda} />
                <F k="Validez de la oferta" v={`${seleccionada.validezDias} días`} />
              </div>
              <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Condiciones comerciales</p>
                <p className="mt-1">{seleccionada.condiciones}</p>
              </div>
              <label className="mt-4 block">
                <span className="text-xs font-medium text-muted-foreground">Margen comercial: {seleccionada.margenPct}% (recalcula el precio)</span>
                <input type="range" min={0} max={40} value={seleccionada.margenPct} onChange={(e) => recalcularMargen(seleccionada, +e.target.value)} className="mt-1 w-full accent-primary" />
              </label>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Cambiar estado:</span>
                {ESTADOS.map((e) => (
                  <Button key={e} size="sm" variant={seleccionada.estado === e ? "default" : "outline"} onClick={() => cambiarEstado(seleccionada, e)}>{e}</Button>
                ))}
              </div>
              <div className="mt-4 flex gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={() => window.print()}><FileDown className="h-4 w-4" />Exportar a PDF</Button>
                <span className="self-center text-[11px] text-muted-foreground">Usa la impresión del navegador (demo).</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ k, v }: { k: string; v: string }) {
  return <div><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium">{v}</p></div>;
}
