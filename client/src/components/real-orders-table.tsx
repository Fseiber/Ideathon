import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { centsToUsd, getOrders, type ApiOrder } from "@/lib/api";
import { STATUS_LABEL } from "@/lib/order-view";
import { Card, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { RealOrderSheet } from "@/components/real-order-sheet";

function fmtUsd(cents: number) {
  return centsToUsd(cents).toLocaleString("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function RealOrdersTable() {
  const [selected, setSelected] = useState<ApiOrder | null>(null);
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders(2),
    refetchInterval: (query) => query.state.data?.some((order) => order.status === "PROCESANDO") ? 2000 : false,
  });

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Órdenes en Stellar testnet</h2>
        <StatusBadge tono="success">Testnet · En vivo</StatusBadge>
      </div>
      {ordersQuery.isError && <p className="mb-3 rounded-lg border border-warning/40 bg-warning-muted/50 p-3 text-sm text-warning-foreground">Backend no disponible — no se pudieron cargar las órdenes reales.</p>}
      <Card>
        {ordersQuery.data?.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground">{["#ID", "Toneladas", "Destino", "Incoterm", "Total USD", "Anticipo", "Saldo", "Estado", ""].map((heading) => <th key={heading} className="pb-2 pr-3 font-medium">{heading}</th>)}</tr></thead><tbody>{ordersQuery.data.map((order) => <tr key={order.id} className="border-b border-border/60 last:border-0"><td className="py-3 pr-3 font-mono text-xs">#{order.id}</td><td className="pr-3">{order.tons} tn</td><td className="pr-3">{order.destination}</td><td className="pr-3">{order.incoterm}</td><td className="pr-3">{fmtUsd(order.totalCents)}</td><td className="pr-3">{fmtUsd(order.advanceCents)}</td><td className="pr-3">{fmtUsd(order.balanceCents)}</td><td className="pr-3"><StatusBadge tono="info">{STATUS_LABEL[order.status]}</StatusBadge></td><td><Button size="sm" variant="outline" onClick={() => setSelected(order)}>Detalle</Button></td></tr>)}</tbody></table></div> : !ordersQuery.isError && <p className="text-sm text-muted-foreground">Todavía no hay órdenes. Pedí una cotización desde el Marketplace.</p>}
      </Card>
      {selected && <RealOrderSheet order={selected} open={selected !== null} onOpenChange={(open) => !open && setSelected(null)} />}
    </section>
  );
}
