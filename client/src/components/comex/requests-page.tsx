import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ApiError, getLots } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { REQUEST_STATUSES, REQUEST_STATUS_LABEL, canWriteRequests, type Incoterm, type PurchaseRequestInput, type RequestStatus } from "@/lib/comex-api";
import { matchLot } from "@/lib/lot-matching";
import { Card, PageHeader, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const inp = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";
export const STATUS_TONO: Record<RequestStatus, "info" | "warning" | "success" | "neutral" | "danger"> = { ABIERTA: "info", EN_ANALISIS: "warning", COTIZADA: "success", CERRADA: "neutral", CANCELADA: "danger" };

export function ComexRequestsPage() {
  const { user, client } = useAuth();
  const canWrite = canWriteRequests(user);
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [buyerCompanyId, setBuyer] = useState<number | "">("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const buyersQuery = useQuery({ queryKey: ["comex", "companies", "COMPRADOR", ""], queryFn: () => client.listCompanies({ role: "COMPRADOR" }) });
  const requestsQuery = useQuery({ queryKey: ["comex", "requests", status, buyerCompanyId, q], queryFn: () => client.listRequests({ status, buyerCompanyId, q }) });

  return (
    <div>
      <PageHeader titulo="Solicitudes de compra" descripcion="Pedidos de compradores registrados y su abastecimiento con lotes publicados." acciones={canWrite && <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />Nueva solicitud</Button>} />
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <select aria-label="Filtrar por comprador" className={`${inp} max-w-[240px]`} value={buyerCompanyId} onChange={(e) => setBuyer(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Todos los compradores</option>
            {buyersQuery.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select aria-label="Filtrar por estado" className={`${inp} max-w-[200px]`} value={status} onChange={(e) => setStatus(e.target.value as RequestStatus | "")}>
            <option value="">Todos los estados</option>
            {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{REQUEST_STATUS_LABEL[s]}</option>)}
          </select>
          <input aria-label="Buscar solicitud" className={`${inp} max-w-sm`} placeholder="Buscar por variedad, destino o comprador…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>
      {requestsQuery.isError && <p className="mb-4 rounded-lg border border-warning/40 bg-warning-muted/50 p-3 text-sm text-warning-foreground">No se pudieron cargar las solicitudes.</p>}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3">#</th><th className="py-2 pr-3">Comprador</th><th className="py-2 pr-3">Producto</th><th className="py-2 pr-3">Toneladas</th><th className="py-2 pr-3">Destino</th><th className="py-2 pr-3">Estado</th><th className="py-2" /></tr></thead>
            <tbody>
              {requestsQuery.data?.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono text-xs">#{r.id}</td>
                  <td className="pr-3">{r.buyer.name}</td>
                  <td className="pr-3">{r.product} · {r.variety}</td>
                  <td className="pr-3">{r.tons} tn</td>
                  <td className="pr-3">{r.destination} · {r.incoterm}</td>
                  <td className="pr-3"><StatusBadge tono={STATUS_TONO[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</StatusBadge></td>
                  <td><Link to="/comex/solicitudes/$id" params={{ id: String(r.id) }} className="text-sm text-primary hover:underline">Ver Matching</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {requestsQuery.data?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No hay solicitudes que coincidan.</p>}
        </div>
      </Card>
      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>Nueva solicitud</SheetTitle><SheetDescription>El comprador debe estar registrado con rol COMPRADOR.</SheetDescription></SheetHeader>
          {creating && <RequestForm buyers={buyersQuery.data ?? []} onCreated={() => setCreating(false)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

type Draft = { buyerCompanyId: string; product: string; variety: string; tons: string; maxBrokenPct: string; maxMoisturePct: string; presentation: string; destination: string; incoterm: Incoterm; requiredBy: string; certifications: string; notes: string };
const EMPTY: Draft = { buyerCompanyId: "", product: "Arroz", variety: "Largo fino", tons: "", maxBrokenPct: "", maxMoisturePct: "", presentation: "", destination: "", incoterm: "FOB", requiredBy: "", certifications: "", notes: "" };
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function RequestForm({ buyers, onCreated }: { buyers: { id: number; name: string }[]; onCreated: () => void }) {
  const { client } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [d, setD] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const lotsQuery = useQuery({ queryKey: ["lots"], queryFn: getLots });
  const set = (field: keyof Draft) => (e: { target: { value: string } }) => setD({ ...d, [field]: e.target.value });

  // Previsualización local con las mismas reglas que el backend; el Matching oficial lo calcula el servidor.
  const preview = useMemo(() => {
    const tons = Number(d.tons);
    if (!lotsQuery.data || d.variety.trim().length < 2 || !Number.isInteger(tons) || tons < 1) return null;
    const request = { variety: d.variety, tons, maxBrokenPct: num(d.maxBrokenPct), maxMoisturePct: num(d.maxMoisturePct), presentation: d.presentation || null };
    const results = lotsQuery.data.map((lot) => matchLot(request, lot).result);
    return { compatible: results.filter((r) => r === "compatible").length, condicional: results.filter((r) => r === "condicional").length };
  }, [d, lotsQuery.data]);

  const create = useMutation({
    mutationFn: () => {
      const body: PurchaseRequestInput = { buyerCompanyId: Number(d.buyerCompanyId), product: d.product, variety: d.variety, tons: Number(d.tons), destination: d.destination, incoterm: d.incoterm, maxBrokenPct: num(d.maxBrokenPct), maxMoisturePct: num(d.maxMoisturePct), presentation: d.presentation || null, requiredBy: d.requiredBy || null, certifications: d.certifications || null, notes: d.notes || null };
      return client.createRequest(body);
    },
    onSuccess: async (created) => {
      toast.success(`Solicitud #${created.id} creada`);
      await queryClient.invalidateQueries({ queryKey: ["comex", "requests"] });
      onCreated();
      await navigate({ to: "/comex/solicitudes/$id", params: { id: String(created.id) } });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "No se pudo crear la solicitud"),
  });

  const submit = (e: FormEvent) => { e.preventDefault(); setError(null); if (!d.buyerCompanyId) { setError("Elegí un comprador"); return; } create.mutate(); };

  return (
    <form onSubmit={submit} className="space-y-3 px-4 pb-4">
      <label className="block space-y-1 text-sm"><span>Comprador</span>
        <select className={inp} value={d.buyerCompanyId} onChange={set("buyerCompanyId")} required>
          <option value="">Elegir comprador…</option>
          {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
      {buyers.length === 0 && <p className="text-xs text-muted-foreground">No hay empresas con rol COMPRADOR. Registrala primero en <Link to="/comex/empresas" className="text-primary hover:underline">Empresas</Link>.</p>}
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1 text-sm"><span>Producto</span><input className={inp} value={d.product} onChange={set("product")} required minLength={2} maxLength={60} /></label>
        <label className="block space-y-1 text-sm"><span>Variedad</span><input className={inp} value={d.variety} onChange={set("variety")} required minLength={2} maxLength={60} /></label>
        <label className="block space-y-1 text-sm"><span>Toneladas</span><input className={inp} type="number" min={1} max={100000} step={1} value={d.tons} onChange={set("tons")} required /></label>
        <label className="block space-y-1 text-sm"><span>Presentación (opcional)</span><input className={inp} value={d.presentation} onChange={set("presentation")} maxLength={60} /></label>
        <label className="block space-y-1 text-sm"><span>Quebrado máx. %</span><input className={inp} type="number" min={0} max={100} step="any" value={d.maxBrokenPct} onChange={set("maxBrokenPct")} /></label>
        <label className="block space-y-1 text-sm"><span>Humedad máx. %</span><input className={inp} type="number" min={0} max={100} step="any" value={d.maxMoisturePct} onChange={set("maxMoisturePct")} /></label>
        <label className="block space-y-1 text-sm"><span>Destino</span><input className={inp} value={d.destination} onChange={set("destination")} required minLength={2} maxLength={80} /></label>
        <label className="block space-y-1 text-sm"><span>Incoterm</span><select className={inp} value={d.incoterm} onChange={set("incoterm")}><option value="FOB">FOB</option><option value="CFR">CFR</option></select></label>
        <label className="block space-y-1 text-sm"><span>Fecha requerida</span><input className={inp} type="date" value={d.requiredBy} onChange={set("requiredBy")} /></label>
        <label className="block space-y-1 text-sm"><span>Certificaciones</span><input className={inp} value={d.certifications} onChange={set("certifications")} maxLength={200} /></label>
      </div>
      <label className="block space-y-1 text-sm"><span>Notas</span><textarea className={`${inp} h-16 py-2`} value={d.notes} onChange={set("notes")} maxLength={2000} /></label>
      {preview && <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">Vista previa: {preview.compatible} lote(s) compatible(s) y {preview.condicional} que requieren confirmación.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={create.isPending}>Crear solicitud</Button>
    </form>
  );
}
