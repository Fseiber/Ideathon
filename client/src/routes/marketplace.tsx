import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileCheck2, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fmtTn, fmtUsd, type Producto } from "@/data/demo";
import { useAppStore } from "@/lib/store";
import { pageHead } from "@/lib/seo";
import { Card, DemoBadge, PageHeader, StatusBadge, tonoEstado } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLots } from "@/lib/api";
import { useChatAssistant } from "@/components/chat-assistant";
import { LotCard } from "@/components/lot-card";

export const Route = createFileRoute("/marketplace")({
  head: () =>
    pageHead(
      "Marketplace B2B",
      "Catálogo de lotes de arroz y productos agroindustriales con filtros por variedad, calidad, volumen y certificaciones. Datos ficticios de demostración.",
    ),
  component: Marketplace,
});

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function Marketplace() {
  const { state } = useAppStore();
  const { open: openChat } = useChatAssistant();
  const lotsQuery = useQuery({ queryKey: ["lots"], queryFn: getLots });
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [provincia, setProvincia] = useState("");
  const [tipo, setTipo] = useState("");
  const [variedad, setVariedad] = useState("");
  const [presentacion, setPresentacion] = useState("");
  const [estado, setEstado] = useState("");
  const [minTn, setMinTn] = useState(0);
  const [maxQuebrado, setMaxQuebrado] = useState(15);
  const [maxHumedad, setMaxHumedad] = useState(16);
  const [cert, setCert] = useState("");
  const [detalle, setDetalle] = useState<Producto | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  const opciones = (k: keyof Producto) => Array.from(new Set(state.productos.map((p) => String(p[k]))));
  const certs = Array.from(new Set(state.productos.flatMap((p) => p.certificaciones)));

  const filtrados = useMemo(
    () =>
      state.productos.filter(
        (p) =>
          (!q || `${p.nombre} ${p.empresa} ${p.variedad}`.toLowerCase().includes(q.toLowerCase())) &&
          (!provincia || p.provincia === provincia) &&
          (!tipo || p.tipoArroz === tipo) &&
          (!variedad || p.variedad === variedad) &&
          (!presentacion || p.presentacion === presentacion) &&
          (!estado || p.estado === estado) &&
          (!cert || p.certificaciones.includes(cert)) &&
          p.cantidadTn >= minTn &&
          p.quebradoPct <= maxQuebrado &&
          p.humedadPct <= maxHumedad,
      ),
    [state.productos, q, provincia, tipo, variedad, presentacion, estado, cert, minTn, maxQuebrado, maxHumedad],
  );

  const limpiar = () => {
    setQ(""); setProvincia(""); setTipo(""); setVariedad(""); setPresentacion(""); setEstado(""); setCert("");
    setMinTn(0); setMaxQuebrado(15); setMaxHumedad(16);
  };

  const solicitarCotizacion = (p: Producto) => {
    toast.success(`Solicitud de cotización iniciada para ${p.id}`, { description: "Te llevamos a la calculadora con este lote." });
    navigate({ to: "/calculadora", search: { lote: p.id } });
  };

  return (
    <div>
      <PageHeader
        titulo="Marketplace B2B agroindustrial"
        descripcion="Lotes tokenizados disponibles de productores y molinos en Stellar testnet."
        acciones={<StatusBadge tono="success">Testnet · En vivo</StatusBadge>}
      />
      {lotsQuery.isError && <p className="mb-4 rounded-lg border border-warning/40 bg-warning-muted/50 p-3 text-sm text-warning-foreground">Backend no disponible — mostrando solo datos demo.</p>}
      <section className="mb-8">
        <div className="mb-1 flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Lotes tokenizados (testnet)</h2><StatusBadge tono="success">Testnet · En vivo</StatusBadge></div>
        <p className="mb-3 text-sm text-muted-foreground">El asistente asigna el lote disponible del molino; precio fijado por el sistema.</p>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{lotsQuery.data?.filter((lot) => lot.tonsAvailable > 0).map((lot) => <LotCard key={lot.id} lot={lot} action={<Button size="sm" onClick={() => openChat(`Quiero cotizar el lote #${lot.id}: `, lot.id)}>Pedir cotización</Button>} />)}{lotsQuery.data && lotsQuery.data.filter((lot) => lot.tonsAvailable > 0).length === 0 && !lotsQuery.isError && <Card><p className="text-sm text-muted-foreground">No hay lotes tokenizados disponibles.</p></Card>}</div>
      </section>
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Marketplace de ejemplo (demo)</h2><DemoBadge /></div>
      {!showDemo && <Button variant="ghost" size="sm" onClick={() => setShowDemo(true)}>Ver lotes de ejemplo (demo)</Button>}
      {showDemo && <>
      <div className="mb-3 mt-6 flex items-center justify-between"><h2 className="text-lg font-semibold">Marketplace de ejemplo</h2><DemoBadge /></div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit space-y-4 lg:sticky lg:top-20">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Filtros</h2>
            <button onClick={limpiar} className="text-xs text-primary hover:underline">Limpiar</button>
          </div>
          <Filtro label="Producto"><select className={sel} disabled><option>Arroz</option></select></Filtro>
          <Filtro label="Provincia de origen">
            <select className={sel} value={provincia} onChange={(e) => setProvincia(e.target.value)}>
              <option value="">Todas</option>
              {opciones("provincia").map((o) => <option key={o}>{o}</option>)}
            </select>
          </Filtro>
          <Filtro label="Tipo de arroz">
            <select className={sel} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {opciones("tipoArroz").map((o) => <option key={o}>{o}</option>)}
            </select>
          </Filtro>
          <Filtro label="Variedad">
            <select className={sel} value={variedad} onChange={(e) => setVariedad(e.target.value)}>
              <option value="">Todas</option>
              {opciones("variedad").map((o) => <option key={o}>{o}</option>)}
            </select>
          </Filtro>
          <Filtro label={`Volumen mínimo: ${minTn} tn`}>
            <input type="range" min={0} max={100} step={5} value={minTn} onChange={(e) => setMinTn(+e.target.value)} className="w-full accent-primary" />
          </Filtro>
          <Filtro label={`Quebrado máximo: ${maxQuebrado}%`}>
            <input type="range" min={1} max={15} value={maxQuebrado} onChange={(e) => setMaxQuebrado(+e.target.value)} className="w-full accent-primary" />
          </Filtro>
          <Filtro label={`Humedad máxima: ${maxHumedad}%`}>
            <input type="range" min={10} max={16} step={0.5} value={maxHumedad} onChange={(e) => setMaxHumedad(+e.target.value)} className="w-full accent-primary" />
          </Filtro>
          <Filtro label="Presentación">
            <select className={sel} value={presentacion} onChange={(e) => setPresentacion(e.target.value)}>
              <option value="">Todas</option>
              {opciones("presentacion").map((o) => <option key={o}>{o}</option>)}
            </select>
          </Filtro>
          <Filtro label="Certificaciones">
            <select className={sel} value={cert} onChange={(e) => setCert(e.target.value)}>
              <option value="">Cualquiera</option>
              {certs.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Filtro>
          <Filtro label="Disponibilidad">
            <select className={sel} value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todas</option>
              <option>Disponible</option><option>Reservado</option><option>Agotado</option>
            </select>
          </Filtro>
        </Card>

        <div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por producto, variedad o empresa…"
              className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{filtrados.length} lote(s) encontrados</p>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filtrados.map((p) => (
              <Card key={p.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{p.id}</span>
                  <StatusBadge tono={tonoEstado(p.estado)}>{p.estado}</StatusBadge>
                </div>
                <h3 className="mt-1.5 text-base font-semibold leading-snug">{p.tipoArroz} {p.variedad.toLowerCase()}</h3>
                <p className="text-xs text-muted-foreground">{p.empresa}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{p.provincia}, {p.pais}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center">
                  <Dato k="Volumen" v={fmtTn(p.cantidadTn)} />
                  <Dato k="Quebrado" v={`${p.quebradoPct}%`} />
                  <Dato k="Humedad" v={`${p.humedadPct}%`} />
                </dl>
                <div className="mt-3 space-y-1 text-xs">
                  <p><span className="text-muted-foreground">Presentación:</span> {p.presentacion}</p>
                  <p><span className="text-muted-foreground">Precio indicativo:</span> {p.precioTnUsd ? `${fmtUsd(p.precioTnUsd)}/tn` : "A consultar"}</p>
                  <p className="flex items-center gap-1"><FileCheck2 className="h-3 w-3 text-success" />{p.documentos.length} documento(s) respaldatorio(s)</p>
                </div>
                <div className="mt-auto flex gap-2 pt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setDetalle(p)}>Ver detalle</Button>
                  <Button size="sm" className="flex-1" disabled={p.estado !== "Disponible"} onClick={() => solicitarCotizacion(p)}>Solicitar cotización</Button>
                </div>
              </Card>
            ))}
            {filtrados.length === 0 && (
              <Card className="col-span-full py-10 text-center text-sm text-muted-foreground">Ningún lote coincide con los filtros seleccionados.</Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="max-w-lg">
          {detalle && (
            <>
              <DialogHeader>
                <DialogTitle>{detalle.nombre}</DialogTitle>
                <DialogDescription>{detalle.empresa} · {detalle.provincia}, {detalle.pais}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Fila k="Tipo" v={detalle.tipoArroz} />
                <Fila k="Variedad" v={detalle.variedad} />
                <Fila k="Grado de elaboración" v={detalle.gradoElaboracion} />
                <Fila k="Volumen" v={fmtTn(detalle.cantidadTn)} />
                <Fila k="Quebrado" v={`${detalle.quebradoPct}%`} />
                <Fila k="Humedad" v={`${detalle.humedadPct}%`} />
                <Fila k="Presentación" v={detalle.presentacion} />
                <Fila k="Precio indicativo" v={detalle.precioTnUsd ? `${fmtUsd(detalle.precioTnUsd)}/tn` : "A consultar"} />
              </div>
              <div className="text-sm">
                <p className="mb-1 font-medium">Certificaciones</p>
                <div className="flex flex-wrap gap-1.5">{detalle.certificaciones.length ? detalle.certificaciones.map((c) => <StatusBadge key={c} tono="success">{c}</StatusBadge>) : <span className="text-muted-foreground">Sin certificaciones cargadas</span>}</div>
                <p className="mb-1 mt-3 font-medium">Documentación respaldatoria</p>
                <ul className="list-disc pl-5 text-muted-foreground">{detalle.documentos.map((d) => <li key={d}>{d}</li>)}</ul>
              </div>
              <Button disabled={detalle.estado !== "Disponible"} onClick={() => solicitarCotizacion(detalle)}>Solicitar cotización</Button>
            </>
          )}
        </DialogContent>
      </Dialog></>}
    </div>
  );
}

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
function Dato({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="text-sm font-semibold">{v}</dd></div>;
}
function Fila({ k, v }: { k: string; v: string }) {
  return <div><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium">{v}</p></div>;
}
