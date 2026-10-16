import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileDown, History, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { INCOTERMS, fmtTn, fmtUsd, type Cotizacion, type EstadoCotizacion, type ParteCotizacion, type TerminosCotizacion } from "@/data/demo";
import { PARTES, aceptar, estaCerrada, proponerVersion, terminosDe, versionVigente, versionesDe, vigentes } from "@/lib/cotizacion-versiones";
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
      "Cotizaciones comerciales internacionales con historial de versiones y aceptación explícita de comprador y vendedor (demo).",
    ),
  component: Cotizaciones,
});

const ESTADOS: EstadoCotizacion[] = ["Borrador", "Enviada", "En negociación", "Aceptada", "Rechazada"];

function Cotizaciones() {
  const { state, dispatch } = useAppStore();
  const { ver } = Route.useSearch();
  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const seleccionada = state.cotizaciones.find((c) => c.id === seleccionadaId) ?? null;

  useEffect(() => {
    if (ver) setSeleccionadaId(ver);
  }, [ver]);

  const lista = state.cotizaciones.filter(
    (c) => (!filtroEstado || c.estado === filtroEstado) && (!q || `${c.id} ${c.comprador} ${c.producto} ${c.paisDestino}`.toLowerCase().includes(q.toLowerCase())),
  );

  const guardar = (c: Cotizacion) => dispatch({ type: "updateCotizacion", id: c.id, patch: c });

  const crearOperacion = (c: Cotizacion) => {
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
    return opId;
  };

  const aceptarComo = (c: Cotizacion, parte: ParteCotizacion) => {
    const actualizada = aceptar(c, parte, hoy());
    guardar(actualizada);
    const numero = versionVigente(c).numero;
    if (actualizada.estado === "Aceptada") {
      const opId = crearOperacion(actualizada);
      toast.success(`Ambas partes aceptaron la v${numero}: se creó la operación ${opId}`);
    } else {
      toast.success(`${etiquetaParte(parte)} aceptó la v${numero}. Falta la aceptación de la otra parte.`);
    }
  };

  const proponer = (c: Cotizacion, autor: ParteCotizacion, terminos: TerminosCotizacion, margenPct: number, nota: string) => {
    const actualizada = proponerVersion(c, autor, terminos, hoy(), nota);
    if (!actualizada) {
      toast.info("No hay cambios respecto de la versión vigente.");
      return false;
    }
    guardar({ ...actualizada, margenPct });
    toast.success(`${etiquetaParte(autor)} propuso la v${versionVigente(actualizada).numero}`);
    return true;
  };

  const cambiarEstado = (c: Cotizacion, estado: EstadoCotizacion) => {
    guardar({ ...c, estado });
    toast.success(`Cotización ${c.id} → ${estado}`);
  };

  return (
    <div>
      <PageHeader
        titulo="Cotizaciones comerciales"
        descripcion="Cada contrapropuesta queda guardada como una versión. La operación se crea solo cuando vendedor y comprador aceptan explícitamente la misma versión."
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
              {["ID", "Fecha", "Comprador", "Producto", "Cantidad", "Precio/tn", "Total", "Incoterm", "Versión", "Estado", ""].map((h) => <th key={h} className="pb-2 pr-3 font-medium">{h}</th>)}
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
                <td className="pr-3 font-mono text-xs">v{versionVigente(c).numero}</td>
                <td className="pr-3"><StatusBadge tono={tonoEstado(c.estado)}>{c.estado}</StatusBadge></td>
                <td><Button size="sm" variant="outline" onClick={() => setSeleccionadaId(c.id)}>Ver</Button></td>
              </tr>))}</tbody>
          </table>
          {lista.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sin cotizaciones. Generala desde la calculadora COMEX.</p>}
        </div>
      </Card>

      <Dialog open={!!seleccionada} onOpenChange={(o) => !o && setSeleccionadaId(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {seleccionada && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                <div>
                  <p className="font-display text-lg font-bold">Cotización comercial internacional</p>
                  <p className="font-mono text-xs text-muted-foreground">{seleccionada.id} · emitida {seleccionada.fecha} · versión vigente v{versionVigente(seleccionada).numero}</p>
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
              <AceptacionPanel c={seleccionada} onAceptar={(parte) => aceptarComo(seleccionada, parte)} />
              {!estaCerrada(seleccionada) && (
                <PropuestaForm
                  key={`${seleccionada.id}-v${versionVigente(seleccionada).numero}`}
                  c={seleccionada}
                  onProponer={(autor, terminos, margen, nota) => proponer(seleccionada, autor, terminos, margen, nota)}
                />
              )}
              <Historial c={seleccionada} />
              {!estaCerrada(seleccionada) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {seleccionada.estado === "Borrador" && <Button size="sm" variant="outline" onClick={() => cambiarEstado(seleccionada, "Enviada")}>Marcar como enviada</Button>}
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => cambiarEstado(seleccionada, "Rechazada")}>Rechazar cotización</Button>
                </div>
              )}
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

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function etiquetaParte(parte: ParteCotizacion) {
  return PARTES.find((p) => p.id === parte)!.label;
}

function AceptacionPanel({ c, onAceptar }: { c: Cotizacion; onAceptar: (parte: ParteCotizacion) => void }) {
  const numero = versionVigente(c).numero;
  const aceptaciones = vigentes(c);
  const cerrada = estaCerrada(c);
  return (
    <div className="mt-4 rounded-lg border border-border p-3">
      <p className="text-sm font-semibold">Aceptación de la versión v{numero}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Cada parte acepta una versión concreta. Si alguien propone cambios, las aceptaciones anteriores dejan de valer.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {PARTES.map(({ id, label }) => {
          const a = aceptaciones[id];
          const nombre = id === "vendedor" ? c.vendedor : c.comprador;
          return (
            <div key={id} className="rounded-md bg-muted/60 p-2.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="truncate text-sm font-medium">{nombre}</p>
              {a ? (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" />Aceptó v{numero} el {a}</p>
              ) : cerrada ? (
                <p className="mt-1.5 text-xs text-muted-foreground">Sin aceptación</p>
              ) : (
                <Button size="sm" className="mt-1.5" onClick={() => onAceptar(id)}>Aceptar v{numero} como {label.toLowerCase()}</Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inp = "mt-1 h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground";

function PropuestaForm({ c, onProponer }: { c: Cotizacion; onProponer: (autor: ParteCotizacion, terminos: TerminosCotizacion, margenPct: number, nota: string) => boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [autor, setAutor] = useState<ParteCotizacion>("comprador");
  const [t, setT] = useState<TerminosCotizacion>(() => terminosDe(c));
  const [margen, setMargen] = useState(c.margenPct);
  const [nota, setNota] = useState("");
  const set = <K extends keyof TerminosCotizacion>(k: K, v: TerminosCotizacion[K]) => setT((prev) => ({ ...prev, [k]: v }));
  const cambiarMargen = (m: number) => {
    const base = c.precioTnUsd / (1 + c.margenPct / 100);
    setMargen(m);
    set("precioTnUsd", +(base * (1 + m / 100)).toFixed(2));
  };

  if (!abierto) return <Button size="sm" variant="outline" className="mt-4" onClick={() => setAbierto(true)}>Proponer nueva versión</Button>;
  return (
    <form
      className="mt-4 space-y-3 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (onProponer(autor, t, margen, nota)) setAbierto(false);
      }}
    >
      <p className="text-sm font-semibold">Nueva versión v{versionVigente(c).numero + 1}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">Propone<select className={inp} value={autor} onChange={(e) => setAutor(e.target.value as ParteCotizacion)}>{PARTES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Cantidad (tn)<input type="number" min={1} className={inp} value={t.cantidadTn} onChange={(e) => set("cantidadTn", +e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">Precio por tonelada (USD)<input type="number" min={0} step="0.01" className={inp} value={t.precioTnUsd} onChange={(e) => set("precioTnUsd", +e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">Incoterm<select className={inp} value={t.incoterm} onChange={(e) => set("incoterm", e.target.value)}>{INCOTERMS.map((i) => <option key={i}>{i}</option>)}</select></label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Lugar designado<input className={inp} value={t.lugarDesignado} onChange={(e) => set("lugarDesignado", e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">Validez (días)<input type="number" min={1} className={inp} value={t.validezDias} onChange={(e) => set("validezDias", +e.target.value)} /></label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Margen comercial del vendedor: {margen}%<input type="range" min={0} max={40} value={margen} onChange={(e) => cambiarMargen(+e.target.value)} className="mt-3 w-full accent-primary" /></label>
      </div>
      <label className="block text-xs text-muted-foreground">Condiciones<textarea className={`${inp} h-16 py-1.5`} value={t.condiciones} onChange={(e) => set("condiciones", e.target.value)} /></label>
      <label className="block text-xs text-muted-foreground">Motivo del cambio (opcional)<input className={inp} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: menor volumen para la primera compra" /></label>
      <div className="flex gap-2">
        <Button type="submit" size="sm">Guardar versión</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
      </div>
    </form>
  );
}

function Historial({ c }: { c: Cotizacion }) {
  const versiones = [...versionesDe(c)].reverse();
  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><History className="h-4 w-4" />Historial de versiones</p>
      <ol className="mt-2 space-y-2">
        {versiones.map((v, index) => {
          const aceptadaPor = PARTES.filter((p) => v.aceptaciones?.[p.id]).map((p) => p.label.toLowerCase());
          return (
            <li key={v.numero} className="rounded-md border border-border p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold">v{v.numero}</span>
                <span className="text-xs text-muted-foreground">{v.fecha} · propuesta por {etiquetaParte(v.autor).toLowerCase()}</span>
                {index === 0 && <StatusBadge tono="info">Vigente</StatusBadge>}
                {aceptadaPor.length > 0 && <StatusBadge tono="success">Aceptada por {aceptadaPor.join(" y ")}</StatusBadge>}
              </div>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">{v.cambios.map((cambio) => <li key={cambio}>{cambio}</li>)}</ul>
              {v.nota && <p className="mt-1.5 text-xs italic text-muted-foreground">“{v.nota}”</p>}
              <p className="mt-1.5 text-xs text-muted-foreground">Total de esta versión: {fmtUsd(v.terminos.precioTnUsd * v.terminos.cantidadTn)}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
