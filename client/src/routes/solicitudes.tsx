import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { fmtTn } from "@/data/demo";
import { useAppStore } from "@/lib/store";
import { pageHead } from "@/lib/seo";
import { Card, DemoBadge, PageHeader, StatusBadge, tonoEstado } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/solicitudes")({
  head: () => pageHead("Solicitudes de compra", "Solicitudes de compra activas de importadores y compradores, con requisitos técnicos y comerciales (datos demo)."),
  component: Solicitudes,
});

function Solicitudes() {
  const { state } = useAppStore();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const lista = state.solicitudes.filter(
    (s) => (!estado || s.estado === estado) && (!q || `${s.id} ${s.comprador} ${s.paisDestino} ${s.variedad}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div>
      <PageHeader
        titulo="Solicitudes de compra"
        descripcion="Demanda registrada por compradores. Las nuevas solicitudes se cargan desde el matching inteligente."
        acciones={<><DemoBadge /><Button asChild><Link to="/matching"><Sparkles className="h-4 w-4" />Nueva solicitud</Link></Button></>}
      />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por comprador, país o variedad…" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" />
          </div>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todos los estados</option><option>Activa</option><option>En negociación</option><option>Cerrada</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground">
              {["ID", "Comprador", "Destino", "Producto", "Volumen", "Quebrado máx.", "Presentación", "Incoterm", "Fecha", "Estado", ""].map((h) => <th key={h} className="pb-2 pr-3 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>{lista.map((s) => (
              <tr key={s.id} className="border-b border-border/60">
                <td className="py-3 pr-3 font-mono text-xs">{s.id}</td>
                <td className="pr-3">{s.comprador}</td>
                <td className="pr-3">{s.paisDestino}</td>
                <td className="pr-3">{s.tipoArroz} {s.variedad}</td>
                <td className="pr-3">{fmtTn(s.volumenTn)}</td>
                <td className="pr-3">{s.quebradoMaxPct}%</td>
                <td className="pr-3">{s.presentacion}</td>
                <td className="pr-3">{s.incoterm}</td>
                <td className="pr-3 text-xs">{s.fechaRequerida}</td>
                <td className="pr-3"><StatusBadge tono={tonoEstado(s.estado)}>{s.estado}</StatusBadge></td>
                <td><Button asChild size="sm" variant="outline"><Link to="/matching" search={{ solicitud: s.id }}>Buscar coincidencias</Link></Button></td>
              </tr>))}</tbody>
          </table>
          {lista.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados.</p>}
        </div>
      </Card>
    </div>
  );
}
