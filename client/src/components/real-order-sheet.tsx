import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { centsToUsd, confirmDelivery, dispatchOrder, fundOrder, shortHash, type ApiEvent, type ApiOrder } from "@/lib/api";
import { eventLink, sortEvents } from "@/lib/order-view";
import { FLOW_STEPS, errorMessage, nextAction, stepIndex } from "@/lib/order-flow";
import { useAppStore } from "@/lib/store";
import { Card, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Props = { order: ApiOrder; open: boolean; onOpenChange: (open: boolean) => void };
type MutationInput = { action: "fund" | "dispatch" | "confirm"; id: string };

function fmtUsd(cents: number) {
  return centsToUsd(cents).toLocaleString("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function RealOrderSheet({ order, open, onOpenChange }: Props) {
  const { state } = useAppStore();
  const queryClient = useQueryClient();
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const actionLock = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ action, id }: MutationInput) => action === "fund" ? fundOrder(id) : action === "dispatch" ? dispatchOrder(id) : confirmDelivery(id),
    onSuccess: (_, variables) => {
      actionLock.current = false;
      setMutationMessage(null);
      toast.success(variables.action === "fund" ? "Escrow fondeado" : variables.action === "dispatch" ? "Despacho confirmado" : "Recepción confirmada y liquidación iniciada");
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order", order.id] });
    },
    onError: (error) => {
      actionLock.current = false;
      setMutationMessage(errorMessage(error));
      toast.error(errorMessage(error));
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order", order.id] });
    },
  });
  const action = nextAction(order.status, state.rol);
  const currentStep = stepIndex(order.status);
  const events = sortEvents(order.events);
  const runAction = (flowAction: MutationInput["action"]) => {
    if (actionLock.current || mutation.isPending) return;
    actionLock.current = true;
    mutation.mutate({ action: flowAction, id: order.id });
  };

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader><SheetTitle>Orden #{order.id}</SheetTitle><SheetDescription>{order.tons} tn ARROZ · {order.destination} · {order.incoterm}</SheetDescription></SheetHeader><div className="mt-5 space-y-6">
    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4"><Money label="Subtotal" cents={order.subtotalCents} /><Money label="Flete" cents={order.freightCents} /><Money label="Total" cents={order.totalCents} /><Money label="Anticipo 30%" cents={order.advanceCents} /><Money label="Saldo" cents={order.balanceCents} /></div>
    <div><h3 className="mb-3 text-sm font-semibold">Flujo de la orden</h3><ol className="relative space-y-5 border-l-2 border-border pl-6">{FLOW_STEPS.map((step, index) => <li key={step.status} className="relative"><span className={`absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full border-2 ${index <= currentStep ? "border-success bg-success text-success-foreground" : "border-border bg-card"}`}>{index <= currentStep && <Check className="h-3 w-3" />}</span><p className={index <= currentStep ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{step.label}</p><div className="mt-2 space-y-2">{eventsForStep(events, step.status).map((event) => <EventRow key={`${event.type}-${event.createdAt}`} event={event} />)}</div></li>)}</ol></div>
    <div className="space-y-2">{action ? <><Button className="w-full" disabled={!action.allowed || mutation.isPending} onClick={() => runAction(action.action)}>{mutation.isPending ? "Firmando en Stellar testnet…" : action.label}</Button>{!action.allowed && <p className="text-sm text-muted-foreground">{action.reason}</p>}{mutationMessage && <p className="text-sm text-destructive">{mutationMessage}</p>}</> : order.status === "PROCESANDO" ? <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">Procesando en la red…</p> : <Button variant="outline" className="w-full" asChild><a href={`/trazabilidad?op=api:${order.id}`}>Ver verificación blockchain</a></Button>}</div>
  </div></SheetContent></Sheet>;
}

function Money({ label, cents }: { label: string; cents: number }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{fmtUsd(cents)}</p></div>; }

function eventsForStep(events: ApiEvent[], status: (typeof FLOW_STEPS)[number]["status"]) {
  const types = status === "FONDEADA" ? ["FUND_ESCROW", "LOCK_TOKENS", "RELEASE_ADVANCE"] : status === "DESPACHADA" ? ["DISPATCHED"] : status === "COMPLETADA" ? ["SETTLE_DVP", "SEAL_HEDERA", "SEAL_ERROR"] : [];
  return events.filter((event) => types.includes(event.type));
}

function EventRow({ event }: { event: ApiEvent }) {
  const link = eventLink(event);
  return <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs"><span>{event.type}</span>{event.txHash && <span className="font-mono text-muted-foreground">{shortHash(event.txHash)}</span>}{link && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={link} target="_blank" rel="noreferrer">StellarExpert <ExternalLink className="h-3 w-3" /></a>}{event.note && <span className="text-muted-foreground">{event.note}</span>}{event.type === "SEAL_ERROR" && <StatusBadge tono="warning">Reintentable</StatusBadge>}</div>;
}
