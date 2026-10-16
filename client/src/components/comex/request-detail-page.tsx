import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { REQUEST_STATUS_LABEL, canWriteRequests, type PurchaseRequest, type RequestStatus } from "@/lib/comex-api";
import { MATCHING_DISCLAIMER, RESULT_LABEL, RESULT_TONO } from "@/lib/lot-matching";
import { Card, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { STATUS_TONO } from "./requests-page";

const usd = (cents: number) => (cents / 100).toLocaleString("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const NOT_EVALUATED_LABEL = { requiredBy: "Fecha requerida", certifications: "Certificaciones" } as const;
const TRANSITION_LABEL: Partial<Record<RequestStatus, string>> = { EN_ANALISIS: "Pasar a análisis", ABIERTA: "Reabrir", CANCELADA: "Cancelar solicitud" };

export function ComexRequestDetailPage({ id }: { id: number }) {
  const { user, client } = useAuth();
  const canWrite = canWriteRequests(user);
  const queryClient = useQueryClient();
  const matchingQuery = useQuery({ queryKey: ["comex", "requests", id, "matching"], queryFn: () => client.getMatching(id), enabled: Number.isInteger(id) && id > 0 });
  const transition = useMutation({
    mutationFn: (status: RequestStatus) => client.setRequestStatus(id, status),
    onSuccess: async (r) => { toast.success(`Solicitud ${REQUEST_STATUS_LABEL[r.status].toLowerCase()}`); await queryClient.invalidateQueries({ queryKey: ["comex", "requests"] }); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "No se pudo cambiar el estado"),
  });

  if (matchingQuery.isPending) return <p className="text-sm text-muted-foreground">Calculando Matching…</p>;
  if (matchingQuery.isError || !matchingQuery.data) return <Card><p className="font-semibold">Solicitud no encontrada</p><Link to="/comex/solicitudes" className="mt-3 inline-block text-sm text-primary hover:underline">Volver a solicitudes</Link></Card>;
  const { request, results, proposal } = matchingQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/comex/solicitudes" className="text-sm text-muted-foreground hover:underline">← Solicitudes</Link>
          <h1 className="text-2xl font-bold">Solicitud #{request.id} · {request.buyer.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{request.tons} tn de {request.product} {request.variety} · {request.destination} · {request.incoterm}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tono={STATUS_TONO[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</StatusBadge>
          {canWrite && request.allowedTransitions.map((s) => <Button key={s} size="sm" variant={s === "CANCELADA" ? "outline" : "default"} disabled={transition.isPending} onClick={() => transition.mutate(s)}>{TRANSITION_LABEL[s] ?? s}</Button>)}
        </div>
      </div>

      <RequirementsCard request={request} />

      <Card>
        <h2 className="mb-3 text-base font-semibold">Propuesta de abastecimiento multilote</h2>
        <p role="note" className="mb-4 rounded-md border border-warning/40 bg-warning-muted/50 p-3 text-xs text-warning-foreground">{MATCHING_DISCLAIMER}</p>
        {proposal.lines.length === 0 ? <p className="text-sm text-muted-foreground">Ningún lote publicado cubre esta solicitud.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3">Proveedor</th><th className="py-2 pr-3">Lote</th><th className="py-2 pr-3">Cantidad</th><th className="py-2 pr-3">Precio/tn</th><th className="py-2 pr-3">Subtotal</th><th className="py-2">Estado</th></tr></thead>
              <tbody>
                {proposal.lines.map((line) => (
                  <tr key={line.lotId} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3">{line.supplier?.name ?? "Molino no vinculado"}</td>
                    <td className="pr-3"><a href={`/lotes/${line.lotId}`} className="text-primary hover:underline">#{line.lotId}</a></td>
                    <td className="pr-3">{line.tons} tn</td>
                    <td className="pr-3">{line.pricePending ? "Pendiente de cotización" : usd(line.pricePerTonCents)}</td>
                    <td className="pr-3">{line.subtotalCents === null ? "—" : usd(line.subtotalCents)}</td>
                    <td><StatusBadge tono={RESULT_TONO[line.result]}>{RESULT_LABEL[line.result]}</StatusBadge>{line.conditions.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">{line.conditions.map((c) => <li key={c}>{c}</li>)}</ul>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Metric label="Cubierto" value={`${proposal.coveredTons} de ${request.tons} tn`} />
          <Metric label="Faltante" value={`${proposal.missingTons} tn`} tone={proposal.missingTons > 0 ? "warn" : undefined} />
          <Metric label={proposal.pricingComplete ? "Subtotal de mercadería" : "Subtotal con precios disponibles"} value={usd(proposal.totalCents)} />
          <Metric label="Precio promedio ponderado" value={proposal.weightedAvgPriceCents ? `${usd(proposal.weightedAvgPriceCents)}/tn` : "—"} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{proposal.totalScope}.{!proposal.pricingComplete && " Hay líneas pendientes de cotización que no suman al subtotal."}</p>
        {proposal.notEvaluated.length > 0 && <p className="mt-2 text-xs text-muted-foreground">No evaluado por el Matching: {proposal.notEvaluated.map((f) => NOT_EVALUATED_LABEL[f]).join(", ")}.</p>}
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold">Compatibilidad por lote</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3">Lote</th><th className="py-2 pr-3">Proveedor</th><th className="py-2 pr-3">Variedad</th><th className="py-2 pr-3">Disponible</th><th className="py-2 pr-3">Resultado</th><th className="py-2">Detalle</th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.lotId} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3">#{r.lotId}</td>
                  <td className="pr-3">{r.lot.supplier?.name ?? "—"}</td>
                  <td className="pr-3">{r.lot.variety}</td>
                  <td className="pr-3">{r.lot.tonsAvailable} tn</td>
                  <td className="pr-3"><StatusBadge tono={RESULT_TONO[r.result]}>{RESULT_LABEL[r.result]}</StatusBadge></td>
                  <td className="text-xs"><ul className="space-y-0.5">{r.failures.map((f) => <li key={f} className="text-destructive">✕ {f}</li>)}{r.conditions.map((c) => <li key={c} className="text-warning-foreground">! {c}</li>)}{r.matches.map((m) => <li key={m} className="text-muted-foreground">✓ {m}</li>)}</ul></td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length === 0 && <p className="py-4 text-sm text-muted-foreground">No hay lotes publicados.</p>}
        </div>
      </Card>
    </div>
  );
}

function RequirementsCard({ request }: { request: PurchaseRequest }) {
  const rows = [
    ["Comprador", request.buyer.name], ["Producto", `${request.product} · ${request.variety}`], ["Toneladas", `${request.tons} tn`],
    ["Quebrado máx.", request.maxBrokenPct === null ? "Sin requisito" : `${request.maxBrokenPct}%`], ["Humedad máx.", request.maxMoisturePct === null ? "Sin requisito" : `${request.maxMoisturePct}%`],
    ["Presentación", request.presentation ?? "Sin requisito"], ["Destino / Incoterm", `${request.destination} · ${request.incoterm}`],
    ["Fecha requerida", request.requiredBy ? new Date(request.requiredBy).toLocaleDateString("es-AR", { timeZone: "UTC" }) : "—"], ["Certificaciones", request.certifications ?? "—"],
  ];
  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold">Requisitos del comprador</h2>
      <div className="grid gap-3 sm:grid-cols-3">{rows.map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div>)}</div>
      {request.notes && <p className="mt-3 text-sm text-muted-foreground">{request.notes}</p>}
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warn" | undefined }) {
  return <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={tone === "warn" ? "text-lg font-semibold text-warning-foreground" : "text-lg font-semibold"}>{value}</p></div>;
}
