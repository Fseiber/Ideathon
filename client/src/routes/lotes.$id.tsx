import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink } from "lucide-react";

import { getHealth, getLots, getOrders } from "@/lib/api";
import { useChatAssistant } from "@/components/chat-assistant";
import { arrozAssetUrl, lotHistory, qualityRows } from "@/lib/passport";
import { ESTADOS_RESPALDO, TONO_RESPALDO, respaldoDelLote, type EstadoRespaldo } from "@/lib/respaldo";
import { Card, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lotes/$id")({ component: LotePassport });

function LotePassport() {
  const { id } = Route.useParams();
  const lotId = Number(id);
  const validId = Number.isInteger(lotId) && lotId > 0;
  const lotsQuery = useQuery({ queryKey: ["lots"], queryFn: getLots });
  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: () => getOrders(2) });
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: getHealth });
  const { open: openChat } = useChatAssistant();
  const lot = validId ? lotsQuery.data?.find((item) => item.id === lotId) : undefined;
  if (!validId || (lotsQuery.data && !lot)) return <main className="mx-auto max-w-4xl p-6"><Card><p className="font-semibold">Lote no encontrado</p><a className="mt-3 inline-block text-sm text-primary hover:underline" href="/marketplace">Volver al Marketplace</a></Card></main>;
  if (lotsQuery.isPending) return <main className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Cargando pasaporte…</main>;
  if (!lot) return <main className="mx-auto max-w-4xl p-6"><Card><p className="font-semibold">Lote no encontrado</p><a className="mt-3 inline-block text-sm text-primary hover:underline" href="/marketplace">Volver al Marketplace</a></Card></main>;
  const history = lotHistory(lot.id, ordersQuery.data ?? []);
  const assetUrl = arrozAssetUrl(healthQuery.data?.issuerPublic ?? null);
  const respaldo = respaldoDelLote(lot);
  const backendError = lotsQuery.isError || ordersQuery.isError || healthQuery.isError;
  return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">AgroFlow</p><h1 className="text-2xl font-bold">Pasaporte digital · Lote #{lot.id}</h1><p className="mt-1 text-sm text-muted-foreground">{lot.product}</p></div><div className="flex flex-wrap gap-2"><StatusBadge tono="info">Emitido en Stellar testnet</StatusBadge><StatusBadge tono={TONO_RESPALDO[respaldo]}>Respaldo físico: {respaldo}</StatusBadge></div></div>{backendError && <p className="rounded-lg border border-warning/40 bg-warning-muted/50 p-3 text-sm text-warning-foreground">Backend no disponible — algunos datos pueden estar incompletos.</p>}<Card><h2 className="mb-4 text-base font-semibold">Ficha comercial</h2><div className="grid gap-3 sm:grid-cols-2">{qualityRows(lot).map((row) => <div key={row.label}><p className="text-xs text-muted-foreground">{row.label}</p><p className="text-sm font-medium">{row.value}</p></div>)}</div></Card><RespaldoCard estado={respaldo} /><Card><h2 className="mb-4 text-base font-semibold">Disponibilidad</h2><div className="grid gap-3 sm:grid-cols-3"><Metric label="Disponible" value={`${lot.tonsAvailable} de ${lot.tonsTotal} tn`} /><Metric label="En escrow" value={`${history.tonsInEscrow} tn`} /><Metric label="Liquidadas" value={`${history.tonsSettled} tn`} /></div><Progress value={lot.tonsTotal ? lot.tonsAvailable / lot.tonsTotal * 100 : 0} className="mt-4 h-2" />{lot.tonsAvailable > 0 && <Button className="mt-4" onClick={() => openChat(`Quiero cotizar el lote #${lot.id}: `, lot.id)}>Pedir cotización de este lote</Button>}</Card><Card><h2 className="mb-4 text-base font-semibold">Representación digital en Stellar</h2><div className="space-y-2 text-sm"><p>Activo: <strong>ARROZ</strong> · 1 ARROZ = 1 tonelada declarada · Emitidos para este lote: {lot.tonsTotal}</p><div className="flex flex-wrap gap-4">{lot.explorerUrl && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={lot.explorerUrl} target="_blank" rel="noreferrer">Ver emisión <ExternalLink className="h-3 w-3" /></a>}{assetUrl && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={assetUrl} target="_blank" rel="noreferrer">Ver activo ARROZ <ExternalLink className="h-3 w-3" /></a>}</div><p>Emisor: {healthQuery.data?.issuerPublic ? <a className="font-mono text-primary hover:underline" href={`https://stellar.expert/explorer/testnet/account/${healthQuery.data.issuerPublic}`} target="_blank" rel="noreferrer">{shortKey(healthQuery.data.issuerPublic)}</a> : "No disponible"}</p></div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">ARROZ es un activo de prueba compartido entre lotes en esta versión; la identificación por lote en la red es parte de la hoja de ruta. El token representa la oferta digital y no acredita por sí solo existencia física, calidad, custodia ni propiedad.</p></Card><Card><h2 className="mb-4 text-base font-semibold">Historial comercial</h2>{history.orders.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3">Orden</th><th className="py-2 pr-3">Toneladas</th><th className="py-2 pr-3">Destino</th><th className="py-2 pr-3">Incoterm</th><th className="py-2 pr-3">Estado</th><th className="py-2" /></tr></thead><tbody>{history.orders.map((order) => <tr key={order.id} className="border-b border-border/60"><td className="py-3 pr-3 font-mono text-xs">#{shortKey(order.id)}</td><td className="pr-3">{order.tons} tn</td><td className="pr-3">{order.destination}</td><td className="pr-3">{order.incoterm}</td><td className="pr-3"><StatusBadge tono={order.status === "COMPLETADA" ? "success" : "info"}>{order.status}</StatusBadge></td><td>{order.status === "COMPLETADA" && <a className="text-primary hover:underline" href={`/comprobante/${order.id}`}>Comprobante</a>}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">Sin operaciones todavía.</p>}</Card></main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function shortKey(value: string) { return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value; }

function RespaldoCard({ estado }: { estado: EstadoRespaldo }) {
  const actual = ESTADOS_RESPALDO.findIndex((item) => item.estado === estado);
  return (
    <Card>
      <h2 className="text-base font-semibold">Respaldo físico de la mercadería</h2>
      <p className="mt-1 text-sm text-muted-foreground">Qué evidencia existe de que el arroz de este lote está disponible y cumple la calidad informada.</p>
      <ol className="mt-4 grid gap-2 sm:grid-cols-4">
        {ESTADOS_RESPALDO.map((item, index) => (
          <li key={item.estado} className={cn("rounded-lg border p-3", index === actual ? "border-warning/60 bg-warning-muted/40" : "border-border opacity-60")}>
            <p className="flex items-center gap-1.5 text-sm font-semibold">{index === actual && <CheckCircle2 className="h-4 w-4 text-warning" />}{item.estado}</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{item.descripcion}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Evidencia disponible</p><p className="mt-1">Datos de calidad declarados por el molino y emisión digital verificable en Stellar testnet.</p></div>
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Evidencia faltante</p><p className="mt-1">Inspección de un certificador independiente (existencia, cantidad y calidad).</p></div>
      </div>
    </Card>
  );
}
