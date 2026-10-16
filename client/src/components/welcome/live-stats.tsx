import React from "react";

export function LiveStats() {
  // Placeholder live stats – in a real app these would come from API or context
  const stats = [
    { label: "Toneladas disponibles", value: "—" },
    { label: "Toneladas tokenizadas", value: "—" },
    { label: "Órdenes activas", value: "—" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3" role="list">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg bg-card p-4 text-center" role="listitem">
          <p className="text-sm text-muted-foreground">{s.label}</p>
          <p className="text-xl font-bold text-foreground">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
