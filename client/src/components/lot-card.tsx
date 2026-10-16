import type { ReactNode } from "react";

import { availableTons, type ApiLot } from "@/lib/api";
import { Card, StatusBadge } from "@/components/ui-kit";
import { Progress } from "@/components/ui/progress";

export function LotCard({ lot, action }: { lot: ApiLot; action?: ReactNode }) {
  const available = availableTons(lot);
  const progress = lot.tonsTotal > 0 ? (available / lot.tonsTotal) * 100 : 0;
  const fmtUsd = (cents: number) => (cents / 100).toLocaleString("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return <Card className="flex flex-col"><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] text-muted-foreground">Lote #{lot.id}</p><h3 className="mt-1 text-base font-semibold">{lot.product}</h3></div><StatusBadge tono="success">Tokenizado en Stellar · {lot.tonsTotal} ARROZ</StatusBadge></div><p className="mt-4 text-sm font-medium">{available} de {lot.tonsTotal} tn disponibles</p>{(lot.tonsReserved ?? 0) > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{lot.tonsReserved} tn con reserva comercial confirmada</p>}<Progress value={progress} className="mt-2 h-2" /><div className="mt-3 space-y-1 text-xs text-muted-foreground"><p>Molino: {lot.supplier?.name ?? "no disponible"}</p><p>{lot.variety} · {lot.province}</p><p>Quebrado: {lot.brokenPct ?? "—"}% · Humedad: {lot.moisturePct ?? "—"}%</p><p>Presentación: {lot.presentation} · {fmtUsd(lot.pricePerTonCents)}/tn</p></div><div className="mt-3 flex items-center justify-between gap-2 text-xs"> <div className="flex gap-2">{lot.explorerUrl ? <a className="text-primary hover:underline" href={lot.explorerUrl} target="_blank" rel="noreferrer">Ver emisión</a> : <span />}<a className="text-primary hover:underline" href={`/lotes/${lot.id}`}>Ver pasaporte</a></div>{action}</div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">1 ARROZ = 1 tonelada declarada. El token representa la oferta digital; no acredita por sí solo existencia física, calidad ni custodia.</p></Card>;
}
