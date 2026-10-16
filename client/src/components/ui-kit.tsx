import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-warning/40 bg-warning-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-foreground",
        className,
      )}
    >
      Demo
    </span>
  );
}

type Tono = "success" | "warning" | "danger" | "info" | "neutral";

const TONOS: Record<Tono, string> = {
  success: "bg-success-muted text-success border-success/30",
  warning: "bg-warning-muted text-warning-foreground border-warning/40",
  danger: "bg-danger-muted text-destructive border-destructive/30",
  info: "bg-info-muted text-info border-info/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ children, tono = "neutral" }: { children: ReactNode; tono?: Tono }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", TONOS[tono])}>
      {children}
    </span>
  );
}

export function tonoEstado(estado: string): Tono {
  const e = estado.toLowerCase();
  if (/(verificado|disponible|compatible$|aceptada|conciliada|recibido|activa)/.test(e)) return "success";
  if (/(pendiente|preparación|negociación|revisar|condicional|observado|reservado|enviada)/.test(e)) return "warning";
  if (/(incompatible|rechazada|diferencia|faltante|agotado|error)/.test(e)) return "danger";
  return "info";
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-card p-5 shadow-sm", className)}>{children}</div>;
}

export function StatCard({
  titulo,
  valor,
  detalle,
  icono,
  tono = "info",
}: {
  titulo: string;
  valor: ReactNode;
  detalle?: string;
  icono: ReactNode;
  tono?: Tono;
}) {
  return (
    <Card className="flex items-start gap-4">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border", TONOS[tono])}>
        {icono}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
        <p className="mt-0.5 text-2xl font-bold text-foreground">{valor}</p>
        {detalle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detalle}</p>}
      </div>
    </Card>
  );
}
