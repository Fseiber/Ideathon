import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, FileText, Paperclip } from "lucide-react";
import { useMemo, useState } from "react";
import { DOCUMENTOS_POR_CATEGORIA, INCOTERMS, PUERTOS_DESTINO, fmtUsd, type DocumentoRequerido } from "@/data/demo";
import { pageHead } from "@/lib/seo";
import { Card, DemoBadge, PageHeader, StatusBadge, tonoEstado } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/documentacion")({
  head: () =>
    pageHead(
      "Documentación internacional",
      "Checklist documental por operación: documentación comercial, aduanera, fitosanitaria, requisitos del país importador y documentación bancaria (demo).",
    ),
  component: Documentacion,
});

const inp = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

function Documentacion() {
  const [config, setConfig] = useState({ producto: "Arroz blanco largo fino", ncm: "1006.30", pais: "República Dominicana", tipo: "Exportación definitiva", incoterm: "FOB", comprador: "Distribuidora Caribe Ltda. (ficticia)" });
  const [estados, setEstados] = useState<Record<string, DocumentoRequerido["estado"]>>({});
  const [generado, setGenerado] = useState(true);

  const docs = useMemo(
    () => DOCUMENTOS_POR_CATEGORIA.map((g) => ({ ...g, documentos: g.documentos.map((d) => ({ ...d, estado: estados[d.id] ?? d.estado })) })),
    [estados],
  );
  const todos = docs.flatMap((g) => g.documentos);
  const aplicables = todos.filter((d) => d.estado !== "No aplica");
  const verificados = aplicables.filter((d) => d.estado === "Verificado").length;
  const avance = aplicables.length ? Math.round((verificados / aplicables.length) * 100) : 0;

  const siguiente = (d: Pick<DocumentoRequerido, "id" | "estado">) => {
    const orden: DocumentoRequerido["estado"][] = ["Pendiente", "En preparación", "Presentado", "Verificado"];
    const i = orden.indexOf(d.estado);
    const siguienteEstado = orden[i + 1];
    if (i >= 0 && siguienteEstado) setEstados((s) => ({ ...s, [d.id]: siguienteEstado }));
  };

  return (
    <div>
      <PageHeader
        titulo="Documentación internacional"
        descripcion="Checklist documental según producto y destino. Los requisitos de país son ejemplos que requieren validación regulatoria antes de una operación real."
        acciones={<DemoBadge />}
      />
      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold">Configuración de la operación</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <L t="Producto"><input className={inp} value={config.producto} onChange={(e) => setConfig({ ...config, producto: e.target.value })} /></L>
          <L t="Código NCM"><input className={inp} value={config.ncm} onChange={(e) => setConfig({ ...config, ncm: e.target.value })} /></L>
          <L t="País de destino"><select className={inp} value={config.pais} onChange={(e) => setConfig({ ...config, pais: e.target.value })}>{Object.keys(PUERTOS_DESTINO).map((p) => <option key={p}>{p}</option>)}</select></L>
          <L t="Tipo de operación"><select className={inp} value={config.tipo} onChange={(e) => setConfig({ ...config, tipo: e.target.value })}><option>Exportación definitiva</option><option>Exportación temporal</option></select></L>
          <L t="Incoterm"><select className={inp} value={config.incoterm} onChange={(e) => setConfig({ ...config, incoterm: e.target.value })}>{INCOTERMS.map((i) => <option key={i}>{i}</option>)}</select></L>
          <L t="Comprador"><input className={inp} value={config.comprador} onChange={(e) => setConfig({ ...config, comprador: e.target.value })} /></L>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={() => setGenerado(true)}>Generar checklist</Button>
          {generado && (
            <div className="flex flex-1 items-center gap-3">
              <Progress value={avance} className="h-2 flex-1" />
              <span className="text-xs font-medium text-muted-foreground">{verificados}/{aplicables.length} verificados ({avance}%)</span>
            </div>
          )}
        </div>
      </Card>

      <Card className="mb-6 border-warning/40 bg-warning-muted/50">
        <p className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" /><span><strong>Importante:</strong> los requisitos del país importador mostrados son ejemplos demostrativos. Ninguna operación aparece como oficialmente habilitada: cada requisito debe validarse con la autoridad o el profesional correspondiente.</span></p>
      </Card>

      {generado && (
        <div className="space-y-4">
          {docs.map((grupo) => (
            <Card key={grupo.categoria} className="p-0">
              <h3 className="border-b border-border px-5 py-3 text-sm font-semibold">{grupo.categoria}</h3>
              <div className="divide-y divide-border/60">
                {grupo.documentos.map((d) => (
                  <div key={d.id} className="grid grid-cols-12 items-center gap-3 px-5 py-3.5">
                    <div className="col-span-12 md:col-span-4">
                      <p className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 shrink-0 text-primary" />{d.nombre}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{d.descripcion}</p>
                    </div>
                    <div className="col-span-6 space-y-0.5 text-xs md:col-span-3">
                      <p><span className="text-muted-foreground">Responsable:</span> {d.responsable}</p>
                      <p><span className="text-muted-foreground">Fuente:</span> {d.fuente}</p>
                      {d.fechaLimite && <p><span className="text-muted-foreground">Límite:</span> {d.fechaLimite}</p>}
                      {d.costoEstimadoUsd != null && <p><span className="text-muted-foreground">Costo est.:</span> {fmtUsd(d.costoEstimadoUsd)}</p>}
                      {d.ultimaVerificacion && <p><span className="text-muted-foreground">Verificado:</span> {d.ultimaVerificacion}</p>}
                      {d.adjunto && <p className="flex items-center gap-1 text-info"><Paperclip className="h-3 w-3" />{d.adjunto}</p>}
                    </div>
                    <div className="col-span-6 flex items-center justify-end gap-2 md:col-span-5">
                      <StatusBadge tono={tonoEstado(d.estado)}>{d.estado}</StatusBadge>
                      {!["Verificado", "No aplica"].includes(d.estado) && <Button size="sm" variant="outline" onClick={() => siguiente(d)}>Avanzar estado</Button>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">{t}</span>{children}</label>;
}
