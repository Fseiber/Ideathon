import { centsToUsd, type ApiOrder } from "@/lib/api";
import { Card, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

function fmtUsd(cents: number) {
  return centsToUsd(cents).toLocaleString("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function QuoteCard({ order }: { order: ApiOrder }) {
  return (
    <Card className="mt-3 border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Cotización #{order.id}</h3><StatusBadge tono="success">Testnet</StatusBadge></div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Lote #{order.lotId}</p>
      <dl className="space-y-2 text-sm">
        <Row label="Toneladas" value={`${order.tons} tn ARROZ`} />
        <Row label="Precio por tn" value={fmtUsd(order.pricePerTonCents)} />
        <Row label="Subtotal" value={fmtUsd(order.subtotalCents)} />
        <Row label="Incoterm + destino" value={`${order.incoterm} · ${order.destination}`} />
        <Row label="Flete" value={order.incoterm === "CFR" ? fmtUsd(order.freightCents) : "No aplica (FOB)"} />
        <Row label={`Derechos de exportación ${order.exportDutyPct}%`} value={`${fmtUsd(order.exportDutyCents)} · informativo, a cargo del molino, no suma al total`} />
        <div className="border-t border-border pt-2"><Row label="TOTAL" value={fmtUsd(order.totalCents)} strong /></div>
        <Row label="Anticipo 30%" value={fmtUsd(order.advanceCents)} />
        <Row label="Saldo contra entrega" value={fmtUsd(order.balanceCents)} />
      </dl>
      <Button className="mt-4 w-full" variant="outline" asChild><a href="/operaciones">Ir a la operación</a></Button>
    </Card>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex items-start justify-between gap-3 ${strong ? "font-bold" : ""}`}><dt className="text-muted-foreground">{label}</dt><dd className="text-right">{value}</dd></div>;
}
