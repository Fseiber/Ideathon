import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, CircleX, Lightbulb, Scale, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { INCOTERMS, fmtTn, type SolicitudCompra } from "@/data/demo";
import { analizarCompatibilidad, explicacionPlantilla, pedidoExplicacion, rankearResultados, type AnalisisMatch, type ResultadoMatch } from "@/lib/matching";
import { explainMatch } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { pageHead } from "@/lib/seo";
import { Card, DemoBadge, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/matching")({
  validateSearch: (s: Record<string, unknown>): { solicitud?: string | undefined } => ({
    solicitud: typeof s["solicitud"] === "string" ? s["solicitud"] : undefined,
  }),
  head: () =>
    pageHead(
      "Matching inteligente",
      "Motor de matching que compara solicitudes de compra con lotes disponibles y clasifica cada coincidencia como compatible, condicional o incompatible.",
    ),
  component: Matching,
});

const inp = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

const ESCENARIOS: Record<string, Partial<SolicitudCompra>> = {
  jazmin: { comprador: "Alimentos Andinos SpA (ficticia)", paisDestino: "Chile", tipoArroz: "Aromático", variedad: "Jazmín", volumenTn: 20, quebradoMaxPct: 5, humedadMaxPct: 14, presentacion: "Envases de 1 kg", incoterm: "CIF", certificaciones: [] },
  largoFino: { comprador: "Distribuidora Caribe Ltda. (ficticia)", paisDestino: "República Dominicana", tipoArroz: "Blanco", variedad: "Largo fino", volumenTn: 40, quebradoMaxPct: 5, humedadMaxPct: 14, presentacion: "Bolsas de 25 kg", incoterm: "FOB", certificaciones: [] },
};

const META: Record<ResultadoMatch, { label: string; icon: typeof CheckCircle2; card: string; chip: string }> = {
  compatible: { label: "Compatible", icon: CheckCircle2, card: "border-success/50 ring-1 ring-success/20", chip: "bg-success text-success-foreground" },
  condicional: { label: "Compatible con condiciones", icon: CircleAlert, card: "border-warning/50", chip: "bg-warning text-warning-foreground" },
  incompatible: { label: "Incompatible", icon: CircleX, card: "border-destructive/30 opacity-90", chip: "bg-destructive text-destructive-foreground" },
};

function Matching() {
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();
  const { solicitud: solicitudId } = Route.useSearch();

  const [form, setForm] = useState<SolicitudCompra>({
    id: "", comprador: "Distribuidora Caribe Ltda. (ficticia)", paisDestino: "República Dominicana", producto: "Arroz",
    tipoArroz: "Blanco", variedad: "Largo fino", volumenTn: 40, quebradoMaxPct: 5, humedadMaxPct: 14,
    presentacion: "Bolsas de 25 kg", incoterm: "FOB", fechaRequerida: "2026-11-30", certificaciones: [], estado: "Activa", observaciones: "",
  });
  const [resultados, setResultados] = useState<AnalisisMatch[] | null>(null);
  const [comparar, setComparar] = useState<AnalisisMatch | null>(null);
  const [analisis, setAnalisis] = useState<{ texto: string; fuente: "gemini" | "plantilla" } | null>(null);
  const [analizando, setAnalizando] = useState(false);

  useEffect(() => {
    if (!solicitudId) return;
    const s = state.solicitudes.find((x) => x.id === solicitudId);
    if (s) {
      setForm(s);
      setResultados(rankearResultados(state.productos.map((p) => analizarCompatibilidad(s, p))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudId]);

  const set = <K extends keyof SolicitudCompra>(k: K, v: SolicitudCompra[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleCert = (c: string) =>
    set("certificaciones", form.certificaciones.includes(c) ? form.certificaciones.filter((x) => x !== c) : [...form.certificaciones, c]);

  const buscar = (e?: React.FormEvent) => {
    e?.preventDefault();
    const sol = { ...form, id: form.id || `SOL-${String(state.solicitudes.length + 1).padStart(3, "0")}` };
    if (!form.id) {
      dispatch({ type: "addSolicitud", solicitud: sol });
      setForm(sol);
    }
    const res = rankearResultados(state.productos.map((p) => analizarCompatibilidad(sol, p)));
    setResultados(res);
    setAnalisis(null);
    const comp = res.filter((r) => r.resultado === "compatible").length;
    toast.success(`Matching completado: ${comp} compatible(s) de ${res.length} lotes`);
  };

  const cargarEscenario = (k: string) => {
    setForm((f) => ({ ...f, ...ESCENARIOS[k], id: "" }));
    setResultados(null);
    setAnalisis(null);
  };

  const analizarOportunidad = async () => {
    if (!resultados) return;
    setAnalizando(true);
    try {
      const { explanation } = await explainMatch(pedidoExplicacion(form, resultados));
      setAnalisis(explanation ? { texto: explanation, fuente: "gemini" } : { texto: explicacionPlantilla(form, resultados), fuente: "plantilla" });
    } catch {
      setAnalisis({ texto: explicacionPlantilla(form, resultados), fuente: "plantilla" });
    } finally {
      setAnalizando(false);
    }
  };

  return (
    <div>
      <PageHeader
        titulo="Matching inteligente"
        descripcion="Cargá los requisitos del comprador y el motor compara contra todos los lotes disponibles. Reglas determinísticas: una variedad distinta nunca se considera compatible."
        acciones={<DemoBadge />}
      />

      <Card className="mb-6 flex flex-wrap items-center gap-3 bg-info-muted/60">
        <Lightbulb className="h-4 w-4 text-info" />
        <span className="text-sm font-medium">Escenarios de demostración:</span>
        <Button size="sm" variant="outline" onClick={() => cargarEscenario("jazmin")}>1 · Comprador busca arroz jazmín</Button>
        <Button size="sm" variant="outline" onClick={() => cargarEscenario("largoFino")}>2 · 40 tn largo fino ≤5% quebrado, 25 kg</Button>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <Card className="h-fit">
          <h2 className="mb-4 text-base font-semibold">Solicitud de compra {form.id && <span className="font-mono text-xs text-muted-foreground">· {form.id}</span>}</h2>
          <form onSubmit={buscar} className="grid grid-cols-2 gap-3">
            <L t="Comprador" full><input className={inp} value={form.comprador} onChange={(e) => set("comprador", e.target.value)} /></L>
            <L t="Producto"><select className={inp} value={form.producto} onChange={(e) => set("producto", e.target.value)}><option>Arroz</option></select></L>
            <L t="Tipo de arroz"><select className={inp} value={form.tipoArroz} onChange={(e) => set("tipoArroz", e.target.value)}><option>Blanco</option><option>Integral</option><option>Aromático</option><option>Parboil</option></select></L>
            <L t="Variedad requerida"><select className={inp} value={form.variedad} onChange={(e) => set("variedad", e.target.value)}><option>Largo fino</option><option>Largo ancho</option><option>Jazmín</option><option>Doble carolina</option></select></L>
            <L t="Volumen (tn)"><input type="number" min={1} className={inp} value={form.volumenTn} onChange={(e) => set("volumenTn", +e.target.value)} /></L>
            <L t="Quebrado máx. (%)"><input type="number" step={0.5} className={inp} value={form.quebradoMaxPct} onChange={(e) => set("quebradoMaxPct", +e.target.value)} /></L>
            <L t="Humedad máx. (%)"><input type="number" step={0.5} className={inp} value={form.humedadMaxPct} onChange={(e) => set("humedadMaxPct", +e.target.value)} /></L>
            <L t="Presentación"><select className={inp} value={form.presentacion} onChange={(e) => set("presentacion", e.target.value)}><option>Bolsas de 25 kg</option><option>Bolsas de 50 kg</option><option>Envases de 1 kg</option><option>Big bags de 1.000 kg</option><option>A granel</option></select></L>
            <L t="País de destino"><input className={inp} value={form.paisDestino} onChange={(e) => set("paisDestino", e.target.value)} /></L>
            <L t="Fecha requerida"><input type="date" className={inp} value={form.fechaRequerida} onChange={(e) => set("fechaRequerida", e.target.value)} /></L>
            <L t="Incoterm preferido"><select className={inp} value={form.incoterm} onChange={(e) => set("incoterm", e.target.value)}>{INCOTERMS.map((i) => <option key={i}>{i}</option>)}</select></L>
            <L t="Certificaciones solicitadas" full>
              <div className="flex flex-wrap gap-2">
                {["Certificado fitosanitario", "Análisis de calidad", "Certificado de origen", "Kosher"].map((c) => (
                  <button type="button" key={c} onClick={() => toggleCert(c)} className={cn("rounded-full border px-2.5 py-1 text-xs", form.certificaciones.includes(c) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent")}>{c}</button>
                ))}
              </div>
            </L>
            <L t="Observaciones" full><textarea rows={2} className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm" value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} /></L>
            <Button type="submit" size="lg" className="col-span-2 mt-1"><Sparkles className="h-4 w-4" />Buscar coincidencias</Button>
          </form>
        </Card>

        <div>
          {!resultados ? (
            <Card className="flex h-full min-h-80 flex-col items-center justify-center text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">Completá la solicitud y presioná “Buscar coincidencias”</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">El motor evaluará variedad, tipo, calidad, volumen, presentación y certificaciones contra {state.productos.length} lotes.</p>
            </Card>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2 text-xs">
                  {(["compatible", "condicional", "incompatible"] as ResultadoMatch[]).map((r) => (
                    <span key={r} className={cn("rounded-full px-2.5 py-1 font-semibold", META[r].chip)}>
                      {resultados.filter((x) => x.resultado === r).length} {META[r].label.toLowerCase()}
                    </span>
                  ))}
                </div>
                <Button variant="outline" onClick={analizarOportunidad} disabled={analizando}><Lightbulb className="h-4 w-4" />{analizando ? "Analizando…" : "Explicar resultado"}</Button>
              </div>
              {analisis && (
                <Card className="mb-4 border-info/30 bg-info-muted/50">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-info"><Lightbulb className="h-3.5 w-3.5" />{analisis.fuente === "gemini" ? "Explicación redactada por Gemini" : "Explicación automática (plantilla)"}</p>
                  <p className="text-sm leading-relaxed">{analisis.texto}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{analisis.fuente === "gemini" ? "La clasificación la calcula el motor de reglas; la IA solo la explica y no puede modificarla." : "Gemini no está disponible: se muestra un resumen generado a partir de las reglas."}</p>
                </Card>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {resultados.map((r) => {
                  const m = META[r.resultado];
                  const Icon = m.icon;
                  return (
                    <Card key={r.producto.id} className={cn("flex flex-col", m.card)}>
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", m.chip)}><Icon className="h-3.5 w-3.5" />{m.label}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{r.producto.id}</span>
                      </div>
                      <h3 className="mt-2 font-semibold">{r.producto.tipoArroz} {r.producto.variedad.toLowerCase()}</h3>
                      <p className="text-xs text-muted-foreground">{r.producto.empresa} · {fmtTn(r.producto.cantidadTn)} disponibles</p>
                      {r.coincidencias.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs">{r.coincidencias.map((c) => <li key={c} className="flex gap-1.5"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" />{c}</li>)}</ul>
                      )}
                      {r.diferencias.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs">{r.diferencias.map((c) => <li key={c} className="flex gap-1.5"><CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-warning" />{c}</li>)}</ul>
                      )}
                      {r.incumplimientos.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs font-medium text-destructive">{r.incumplimientos.map((c) => <li key={c} className="flex gap-1.5"><CircleX className="mt-0.5 h-3 w-3 shrink-0" />{c}</li>)}</ul>
                      )}
                      <div className="mt-auto flex gap-2 pt-4">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setComparar(r)}><Scale className="h-3.5 w-3.5" />Comparar</Button>
                        <Button size="sm" className="flex-1" disabled={r.resultado === "incompatible"} onClick={() => { toast.success(`Cotización solicitada sobre ${r.producto.id}`); navigate({ to: "/calculadora", search: { lote: r.producto.id, solicitud: form.id } }); }}>Solicitar cotización</Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <Sheet open={!!comparar} onOpenChange={(o) => !o && setComparar(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {comparar && (
            <>
              <SheetHeader>
                <SheetTitle>Comparación técnica</SheetTitle>
                <SheetDescription>Solicitud {form.id} vs. lote {comparar.producto.id}</SheetDescription>
              </SheetHeader>
              <table className="mt-4 w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="pb-2">Atributo</th><th className="pb-2">Solicitado</th><th className="pb-2">Lote</th><th /></tr></thead>
                <tbody>
                  {[
                    ["Tipo", form.tipoArroz, comparar.producto.tipoArroz, form.tipoArroz === comparar.producto.tipoArroz],
                    ["Variedad", form.variedad, comparar.producto.variedad, form.variedad === comparar.producto.variedad],
                    ["Volumen", fmtTn(form.volumenTn), fmtTn(comparar.producto.cantidadTn), comparar.producto.cantidadTn >= form.volumenTn],
                    ["Quebrado", `≤ ${form.quebradoMaxPct}%`, `${comparar.producto.quebradoPct}%`, comparar.producto.quebradoPct <= form.quebradoMaxPct],
                    ["Humedad", `≤ ${form.humedadMaxPct}%`, `${comparar.producto.humedadPct}%`, comparar.producto.humedadPct <= form.humedadMaxPct],
                    ["Presentación", form.presentacion, comparar.producto.presentacion, form.presentacion === comparar.producto.presentacion],
                    ["Disponibilidad", "Disponible", comparar.producto.estado, comparar.producto.estado === "Disponible"],
                  ].map(([k, a, b, ok]) => (
                    <tr key={String(k)} className="border-b border-border/60">
                      <td className="py-2.5 text-muted-foreground">{k}</td><td>{a}</td><td className="font-medium">{b}</td>
                      <td>{ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <CircleX className="h-4 w-4 text-destructive" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 rounded-lg bg-muted p-3 text-sm leading-relaxed">{comparar.resumen}</div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function L({ t, children, full }: { t: string; children: React.ReactNode; full?: boolean }) {
  return <label className={cn("space-y-1", full && "col-span-2")}><span className="text-xs font-medium text-muted-foreground">{t}</span>{children}</label>;
}
