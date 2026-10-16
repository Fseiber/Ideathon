export const statusStyle: Record<string, { tono: string; label: string }> = {
  COTIZADA: { tono: "neutral", label: "Cotizada" },
  PROCESANDO: { tono: "info", label: "Procesando…" },
  FONDEADA: { tono: "warning", label: "Fondeada · en garantía" },
  DESPACHADA: { tono: "info", label: "Despachada (simulado)" },
  COMPLETADA: { tono: "success", label: "Liquidada en Stellar" },
};

export type OrderStatus = keyof typeof statusStyle;
