import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, FileOutput, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { INCOTERMS, PROVINCIAS, PUERTOS_ARGENTINA, PUERTOS_DESTINO, fmtUsd } from "@/data/demo";
import { GRUPOS_COSTO, conceptosIniciales, simular, type ConceptoCosto, type ParametrosSimulacion } from "@/lib/comex";
import { useAppStore } from "@/lib/store";
import { pageHead } from "@/lib/seo";
import { Card, DemoBadge, PageHeader, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calculadora")({
  validateSearch: (s: Record<string, unknown>): { lote?: string; solicitud?: string } => ({
    lote: typeof s.lote === "string" ? s.lote : undefined,
    solicitud: typeof s.solicitud === "string" ? s.solicitud : undefined,
  }),
  head: () =>
    pageHead(
      "Calculadora COMEX",
      "Simulador de costos de exportación: mercadería, logística, gastos portuarios, aduana, flete internacional y gastos financieros, con precios FCA/FOB/CFR/CIF según Incoterms 2020.",
    ),
  component: Calculadora,
});

const inp = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm";
const COLORES = ["var(--color-chart-2)", "var(--color-chart-1)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)", "oklch(0.6 0.1 200)"];

function Calculadora() {
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();
  const { lote, solicitud } = Route.useSearch();

  const [params, setParams] = useState<ParametrosSimulacion>({
    producto: "Arroz blanco largo fino",
    cantidadTn: 40,
    contenedores: 2,
    incoterm: "FOB",
    tipoCambioArs: 1050,
    margenPct: 12,
  });
  const [provincia, setProvincia] = useState("Chaco");
  const [puertoSalida, setPuertoSalida] = useState("Buenos Aires");
  const [paisDestino, setPaisDestino] = useState("República Dominicana");
  const [puertoDestino, setPuertoDestino] = useState("Caucedo");
  const [fechaEmbarque, setFechaEmbarque] = useState("2026-11-30");
  const [presentacion, setPresentacion] = useState("Bolsas de 25 kg");
  const [conceptos, setConceptos] = useState<ConceptoCosto[]>(conceptosIniciales);

  useEffect(() => {
    if (!lote) return;
    const p = state.productos.find((x) => x.id === lote);
    if (p) {
      setParams((f) => ({ ...f, producto: `${p.tipoArroz} ${p.variedad.toLowerCase()}`, cantidadTn: Math.min(p.cantidadTn, 40) }));
      setProvincia(p.provincia);
      setPresentacion(p.presentacion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lote]);

  const resultado = useMemo(() => simular(conceptos, params), [conceptos, params]);
  const setC = (id: string, patch: Partial<ConceptoCosto>) => setConceptos((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const generarCotizacion = () => {
    const precioTn = +(params.cantidadTn > 0 ? (resultado.costoVendedorUsd / params.cantidadTn) * (1 + params.margenPct / 100) : 0).toFixed(2);
    const id = `COT-2026-${String(state.cotizaciones.length + 1).padStart(3, "0")}`;
    dispatch({
      type: "addCotizacion",
      cotizacion: {
        id,
        vendedor: "AgroExport NEA S.A. (demo)",
        comprador: solicitud ? (state.solicitudes.find((s) => s.id === solicitud)?.comprador ?? "Comprador (demo)") : "Comprador internacional (demo)",
        producto: params.producto,
        calidad: "Según análisis de laboratorio (demo)",
        cantidadTn: params.cantidadTn,
        precioTnUsd: precioTn,
        incoterm: params.incoterm,
        lugarDesignado: `${puertoSalida}, Argentina`,
        paisDestino,
        presentacion,
        fecha: new Date().toISOString().slice(0, 10),
        moneda: "USD",
        condiciones: "Generada desde la calculadora COMEX. Condiciones de pago a definir.",
        validezDias: 15,
        estado: "Borrador",
        margenPct: params.margenPct,
      },
    });
    navigate({ to: "/cotizaciones", search: { ver: id } });
  };

  return (
    <div>
      <PageHeader
        titulo="Calculadora inteligente de exportación"
        descripcion="Simulación de costos con clasificación coherente con Incoterms 2020. Los campos normativos figuran como pendientes de verificación: la herramienta no usa tasas ni aranceles inventados."
        acciones={<DemoBadge />}
      />

      {/* Parámetros */}
      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold">Parámetros de la operación{lote && <span className="ml-2 font-mono text-xs text-muted-foreground">lote {lote}</span>}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <L t="Producto" span={2}><input className={inp} value={params.producto} onChange={(e) => setParams({ ...params, producto: e.target.value })} /></L>
          <L t="Cantidad (tn)"><input type="number" min={1} className={inp} value={params.cantidadTn} onChange={(e) => setParams({ ...params, cantidadTn: +e.target.value })} /></L>
          <L t="Contenedores 40'"><input type="number" min={0} className={inp} value={params.contenedores} onChange={(e) => setParams({ ...params, contenedores: +e.target.value })} /></L>
          <L t="Presentación"><select className={inp} value={presentacion} onChange={(e) => setPresentacion(e.target.value)}><option>Bolsas de 25 kg</option><option>Bolsas de 50 kg</option><option>Envases de 1 kg</option><option>Big bags de 1.000 kg</option><option>A granel</option></select></L>
          <L t="Provincia de origen"><select className={inp} value={provincia} onChange={(e) => setProvincia(e.target.value)}>{PROVINCIAS.map((p) => <option key={p}>{p}</option>)}</select></L>
          <L t="Puerto de salida"><select className={inp} value={puertoSalida} onChange={(e) => setPuertoSalida(e.target.value)}>{PUERTOS_ARGENTINA.map((p) => <option key={p}>{p}</option>)}</select></L>
          <L t="País de destino"><select className={inp} value={paisDestino} onChange={(e) => { setPaisDestino(e.target.value); setPuertoDestino(PUERTOS_DESTINO[e.target.value]?.[0] ?? ""); }}>{Object.keys(PUERTOS_DESTINO).map((p) => <option key={p}>{p}</option>)}</select></L>
          <L t="Puerto de destino"><select className={inp} value={puertoDestino} onChange={(e) => setPuertoDestino(e.target.value)}>{(PUERTOS_DESTINO[paisDestino] ?? []).map((p) => <option key={p}>{p}</option>)}</select></L>
          <L t="Incoterm"><select className={inp} value={params.incoterm} onChange={(e) => setParams({ ...params, incoterm: e.target.value })}>{INCOTERMS.map((i) => <option key={i}>{i}</option>)}</select></L>
          <L t="Fecha estimada de embarque"><input type="date" className={inp} value={fechaEmbarque} onChange={(e) => setFechaEmbarque(e.target.value)} /></L>
          <L t="Tipo de cambio (ARS/USD)"><input type="number" className={inp} value={params.tipoCambioArs} onChange={(e) => setParams({ ...params, tipoCambioArs: +e.target.value })} /></L>
        </div>
      </Card>

      {/* Grupos de costos */}
      <div className="grid gap-4 xl:grid-cols-2">
        {GRUPOS_COSTO.map((grupo) => {
          const items = conceptos.filter((c) => c.grupo === grupo);
          const total = resultado.porGrupo.find((g) => g.grupo === grupo);
          return (
            <Card key={grupo} className="p-0">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold">{grupo}</h3>
                <div className="flex items-center gap-2">
                  <StatusBadge tono={total?.asumidoVendedor ? "info" : "neutral"}>{total?.asumidoVendedor ? "Vendedor" : "Comprador"}</StatusBadge>
                  <span className="text-sm font-bold">{fmtUsd(total?.totalUsd ?? 0)}</span>
                </div>
              </div>
              <div className="divide-y divide-border/60">
                {items.map((c) => (
                  <div key={c.id} className={cn("grid grid-cols-12 items-center gap-2 px-5 py-2.5", c.incluidoEnOtraTarifa && "opacity-50")}>
                    <div className="col-span-12 md:col-span-4">
                      <p className="text-xs font-medium leading-tight">{c.concepto}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <TipoDatoBadge tipo={c.tipoDato} />
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <input type="checkbox" checked={c.incluidoEnOtraTarifa} onChange={(e) => setC(c.id, { incluidoEnOtraTarifa: e.target.checked })} />
                          Incluido en otra tarifa
                        </label>
                      </div>
                      {c.nota && <p className="mt-1 text-[10px] leading-snug text-warning-foreground">{c.nota}</p>}
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <input type="number" step="0.1" className={inp} value={c.importe} onChange={(e) => setC(c.id, { importe: +e.target.value })} aria-label="Importe" />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <select className={inp} value={c.moneda} onChange={(e) => setC(c.id, { moneda: e.target.value as "USD" | "ARS" })} aria-label="Moneda"><option>USD</option><option>ARS</option></select>
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <select className={inp} value={c.unidad} onChange={(e) => setC(c.id, { unidad: e.target.value as ConceptoCosto["unidad"] })} aria-label="Unidad">
                        <option value="por_tonelada">por tonelada</option><option value="por_contenedor">por contenedor</option><option value="por_operacion">por operación</option><option value="por_dia">por día</option><option value="porcentaje">porcentaje</option>
                      </select>
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <select className={inp} value={c.responsable} onChange={(e) => setC(c.id, { responsable: e.target.value as ConceptoCosto["responsable"] })} aria-label="Responsable">
                        <option value="vendedor">Vendedor</option><option value="comprador">Comprador</option><option value="segun_incoterm">Según Incoterm</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Resultados */}
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <h2 className="mb-1 text-base font-semibold">Composición de costos</h2>
          <p className="mb-4 text-xs text-muted-foreground">Total por grupo (USD). Los grupos asignados al comprador según {params.incoterm} no se suman al costo del vendedor.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resultado.porGrupo.map((g, i) => ({ ...g, nombre: g.grupo.slice(0, 1), fill: COLORES[i] }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="grupo" width={200} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip formatter={(v) => fmtUsd(Number(v))} contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="totalUsd" name="USD" radius={[0, 6, 6, 0]}>
                  {resultado.porGrupo.map((_, i) => <Cell key={i} fill={COLORES[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-2">
          <Card>
            <h2 className="mb-3 text-base font-semibold">Resultados de la simulación</h2>
            <dl className="space-y-2 text-sm">
              <FilaR k="Costo total de mercadería" v={fmtUsd(resultado.costoMercaderiaUsd)} />
              <FilaR k={`Costos asumidos por el vendedor (${params.incoterm})`} v={fmtUsd(resultado.costoVendedorUsd)} strong />
              <FilaR k="Costo por tonelada" v={`${fmtUsd(resultado.costoPorTnUsd, 2)}/tn`} />
              <FilaR k="Precio mínimo de venta" v={`${fmtUsd(resultado.precioMinimoTnUsd, 2)}/tn`} />
            </dl>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-muted-foreground">Margen esperado: {params.margenPct}%</span>
              <input type="range" min={0} max={40} value={params.margenPct} onChange={(e) => setParams({ ...params, margenPct: +e.target.value })} className="mt-1 w-full accent-primary" />
            </label>
            <div className="mt-3 rounded-lg bg-primary p-3 text-primary-foreground">
              <p className="text-xs opacity-80">Precio estimado {params.incoterm} con margen</p>
              <p className="text-2xl font-bold">{fmtUsd(resultado.costoPorTnUsd * (1 + params.margenPct / 100), 2)}/tn</p>
              <p className="text-xs opacity-80">Total: {fmtUsd(resultado.costoVendedorUsd * (1 + params.margenPct / 100))}</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["FOB", resultado.precioFobTnUsd], ["CFR", resultado.precioCfrTnUsd], ["CIF", resultado.precioCifTnUsd]].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-border p-2">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">{k}</p>
                  <p className="text-sm font-bold">{fmtUsd(v as number, 0)}/tn</p>
                </div>
              ))}
            </div>
          </Card>

          {resultado.pendientesVerificacion.length > 0 && (
            <Card className="border-warning/40 bg-warning-muted/50">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-warning-foreground" />Pendientes de verificación</p>
              <ul className="mt-1.5 list-disc pl-5 text-xs text-muted-foreground">{resultado.pendientesVerificacion.map((p) => <li key={p}>{p}</li>)}</ul>
              <p className="mt-2 text-[11px] text-muted-foreground">Estos valores no se calculan con tasas oficiales: cargalos manualmente tras verificar la normativa o cotizar el servicio.</p>
            </Card>
          )}

          <div className="flex gap-2">
            <Button className="flex-1" size="lg" onClick={generarCotizacion}><FileOutput className="h-4 w-4" />Generar cotización</Button>
            <Button variant="outline" size="lg" onClick={() => setConceptos(conceptosIniciales())}><RotateCcw className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function L({ t, children, span }: { t: string; children: React.ReactNode; span?: number }) {
  return <label className={cn("space-y-1", span === 2 && "col-span-2")}><span className="text-xs font-medium text-muted-foreground">{t}</span>{children}</label>;
}
function FilaR({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className={cn("flex items-center justify-between", strong && "rounded-md bg-muted px-2 py-1")}><dt className="text-muted-foreground">{k}</dt><dd className={cn("font-semibold", strong && "text-base")}>{v}</dd></div>;
}
function TipoDatoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    estimado: { label: "Estimado", cls: "bg-muted text-muted-foreground" },
    cotizado: { label: "Cotizado", cls: "bg-info-muted text-info" },
    verificado: { label: "Verificado", cls: "bg-success-muted text-success" },
    pendiente: { label: "Pendiente de verificación", cls: "bg-warning-muted text-warning-foreground" },
  };
  const m = map[tipo] ?? map.estimado;
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", m.cls)}>{m.label}</span>;
}
