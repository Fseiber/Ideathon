import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useAppStore } from "@/lib/store";
import { createLot, getLots, type ApiLot, type LotAttributes } from "@/lib/api";
import { errorMessage } from "@/lib/order-flow";
import { pageHead } from "@/lib/seo";
import { Card, DemoBadge, PageHeader, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { LotCard } from "@/components/lot-card";

export const Route = createFileRoute("/mis-productos")({
  head: () => pageHead("Mis lotes", "Publicá y gestioná lotes de arroz tokenizados en Stellar testnet."),
  component: MisProductos,
});

const inputClass = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

function MisProductos() {
  const { state } = useAppStore();
  const queryClient = useQueryClient();
  const lotsQuery = useQuery({ queryKey: ["lots"], queryFn: getLots });
  const publishing = useRef(false);
  const [product, setProduct] = useState("Arroz largo fino");
  const [tons, setTons] = useState("50");
  const [attrs, setAttrs] = useState({ variety: "", province: "", presentation: "", brokenPct: "", moisturePct: "", pricePerTonUsd: "" });
  const [error, setError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const mutation = useMutation({
    mutationFn: ({ tons: amount, product: name, attributes }: { tons: number; product: string; attributes?: LotAttributes }) => attributes ? createLot(amount, name, attributes) : createLot(amount, name),
    onSuccess: (lot: ApiLot) => { publishing.current = false; toast.success("Lote publicado y tokenizado", { description: lot.explorerUrl ?? "Emisión registrada en Stellar testnet." }); void queryClient.invalidateQueries({ queryKey: ["lots"] }); },
    onError: (reason) => { publishing.current = false; const message = errorMessage(reason); setError(message); toast.error(message); },
  });
  const updateAttr = (key: keyof typeof attrs, value: string) => setAttrs((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (publishing.current || mutation.isPending) return;
    const amount = Number(tons);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) { setError("Las toneladas deben ser un entero entre 1 y 100000."); return; }
    const attributes: LotAttributes = {};
    if (attrs.variety.trim()) attributes.variety = attrs.variety.trim();
    if (attrs.province.trim()) attributes.province = attrs.province.trim();
    if (attrs.presentation.trim()) attributes.presentation = attrs.presentation.trim();
    if (attrs.brokenPct !== "") attributes.brokenPct = Number(attrs.brokenPct);
    if (attrs.moisturePct !== "") attributes.moisturePct = Number(attrs.moisturePct);
    if (attrs.pricePerTonUsd !== "") attributes.pricePerTonUsd = Number(attrs.pricePerTonUsd);
    publishing.current = true; setError(null);
    const input = { tons: amount, product: product.trim() || "Arroz largo fino" };
    if (Object.keys(attributes).length) mutation.mutate({ ...input, attributes });
    else mutation.mutate(input);
  };
  const demoProducts = state.productos.filter((item) => item.propio);

  return <div>
    <PageHeader titulo="Mis lotes" descripcion="Publicá lotes propios y tokenizalos en Stellar testnet." />
    {lotsQuery.isError && <p className="mb-4 rounded-lg border border-warning/40 bg-warning-muted/50 p-3 text-sm text-warning-foreground">Backend no disponible — mostrando solo datos demo.</p>}
    <section className="mb-8"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Lotes reales en Stellar testnet</h2><StatusBadge tono="success">Testnet · En vivo</StatusBadge></div>{state.rol !== "productor" ? <Card><p className="text-sm text-muted-foreground">Cambiá al rol Productor / Molino para publicar</p></Card> : <div className="grid gap-6 xl:grid-cols-[340px_1fr]"><Card><h3 className="mb-4 text-base font-semibold">Publicar y tokenizar</h3><form onSubmit={submit} className="space-y-3"><Field label="Producto"><input className={inputClass} value={product} onChange={(event) => setProduct(event.target.value)} /></Field><Field label="Toneladas"><input className={inputClass} type="number" min={1} max={100000} step={1} value={tons} onChange={(event) => setTons(event.target.value)} /></Field><Field label="Variedad (opcional)"><input className={inputClass} value={attrs.variety} onChange={(event) => updateAttr("variety", event.target.value)} /></Field><Field label="Provincia (opcional)"><input className={inputClass} value={attrs.province} onChange={(event) => updateAttr("province", event.target.value)} /></Field><Field label="Presentación (opcional)"><input className={inputClass} value={attrs.presentation} onChange={(event) => updateAttr("presentation", event.target.value)} /></Field><div className="grid grid-cols-2 gap-2"><Field label="Quebrado %"><input className={inputClass} type="number" min={0} max={100} step="any" value={attrs.brokenPct} onChange={(event) => updateAttr("brokenPct", event.target.value)} /></Field><Field label="Humedad %"><input className={inputClass} type="number" min={0} max={100} step="any" value={attrs.moisturePct} onChange={(event) => updateAttr("moisturePct", event.target.value)} /></Field></div><Field label="Precio USD/tn"><input className={inputClass} type="number" min={0} step="any" value={attrs.pricePerTonUsd} onChange={(event) => updateAttr("pricePerTonUsd", event.target.value)} /></Field>{error && <p className="text-sm text-destructive">{error}</p>}<Button type="submit" className="w-full" disabled={mutation.isPending}>{mutation.isPending ? "Emitiendo tokens en Stellar testnet…" : "Publicar y tokenizar"}</Button></form></Card><div className="grid gap-4 md:grid-cols-2">{lotsQuery.data?.map((lot) => <LotCard key={lot.id} lot={lot} />)}</div></div>}</section>
    {!showDemo && <Button variant="ghost" size="sm" onClick={() => setShowDemo(true)}>Ver lotes de ejemplo (demo)</Button>}
    {showDemo && <section className="mt-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Lotes de ejemplo</h2><DemoBadge /></div><Card>{demoProducts.length === 0 ? <p className="text-sm text-muted-foreground">No hay lotes demo propios.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="pb-2">ID</th><th className="pb-2">Producto</th><th className="pb-2">Volumen</th><th className="pb-2">Estado</th></tr></thead><tbody>{demoProducts.map((item) => <tr key={item.id} className="border-b border-border/60"><td className="py-2.5 font-mono text-xs">{item.id}</td><td>{item.tipoArroz} {item.variedad}</td><td>{item.cantidadTn} tn</td><td>{item.estado}</td></tr>)}</tbody></table></div>}</Card></section>}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>; }
