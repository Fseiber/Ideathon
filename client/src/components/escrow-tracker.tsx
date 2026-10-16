import { Check, CircleDashed, ExternalLink } from "lucide-react";

import { centsToUsd, type ApiOrder } from "@/lib/api";
import { escrowView } from "@/lib/escrow-view";
import { Card, StatusBadge } from "@/components/ui-kit";

function fmtUsd(cents: number) { return centsToUsd(cents).toLocaleString("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }); }

export function EscrowTracker({ order }: { order: ApiOrder }) {
  const view = escrowView(order);
  const firstPending = view.stages.findIndex((stage) => !stage.done);
  return <Card className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Metric label="En garantía" value={`${fmtUsd(view.heldCents)} USDC de prueba`} /><Metric label="Tokens bloqueados" value={`${view.tokensHeld} ARROZ`} /><Metric label="Liberado al molino" value={`${fmtUsd(view.releasedToMillCents)} USDC de prueba`} /></div><ol className="relative space-y-4 border-l-2 border-border pl-5">{view.stages.map((stage, index) => <li key={stage.key} className="relative"><span className={`absolute -left-[30px] flex h-5 w-5 items-center justify-center rounded-full border-2 ${stage.done ? "border-success bg-success text-success-foreground" : "border-border bg-card"}`}>{stage.done ? <Check className="h-3 w-3" /> : <CircleDashed className={`h-3 w-3 text-muted-foreground ${view.processing && index === firstPending ? "animate-spin" : ""}`} />}</span><div className="flex flex-wrap items-center justify-between gap-2"><p className={stage.done ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{stage.label}</p><StatusBadge tono={stage.onChain ? "info" : "warning"}>{stage.onChain ? "En Stellar" : "Simulado"}</StatusBadge></div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{stage.amountCents !== undefined && <span>{fmtUsd(stage.amountCents)} USDC de prueba</span>}{stage.tons !== undefined && <span>{stage.tons} ARROZ</span>}{stage.link && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={stage.link} target="_blank" rel="noreferrer">Ver tx <ExternalLink className="h-3 w-3" /></a>}{view.processing && index === firstPending && <span className="inline-flex items-center gap-1 text-info">Procesando en la red…</span>}</div></li>)}</ol><p className="text-xs text-muted-foreground">Escrow custodial operado por la plataforma en Stellar testnet. El despacho y la entrega son simulados.</p></Card>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
