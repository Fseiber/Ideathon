import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ExternalLink, Fingerprint, ShieldCheck } from "lucide-react";

import { ApiError, centsToUsd, getHealth, sealOrder, shortHash, verifyOrder, type ApiOrder } from "@/lib/api";
import { EVENT_LABEL, eventLink, sortEvents, STATUS_LABEL } from "@/lib/order-view";
import { Card, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { EscrowTracker } from "@/components/escrow-tracker";

type Verification = { valid: boolean; hash: string; sealedHash: string; onChain: boolean | null };

function fmtUsd(cents: number) {
  return centsToUsd(cents).toLocaleString("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function BlockchainPanel({ order }: { order: ApiOrder }) {
  const queryClient = useQueryClient();
  const healthQuery = useQuery({ queryKey: ["health"], queryFn: getHealth });
  const health = healthQuery.data;
  const showHedera = Boolean(health && !healthQuery.isError && health.hederaMode !== "off");
  const [sealing, setSealing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [sealMessage, setSealMessage] = useState<string | null>(null);

  async function handleSeal() {
    setSealing(true);
    setSealMessage(null);
    try {
      await sealOrder(order.id);
      await queryClient.invalidateQueries({ queryKey: ["order", order.id] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      setSealMessage(error instanceof Error ? error.message : "No se pudo sellar la orden");
    } finally {
      setSealing(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setVerifyMessage(null);
    try {
      const result = await verifyOrder(order.id);
      if (isVerification(result)) setVerification(result);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.code === "NOT_SEALED") setVerifyMessage("La orden aún no está sellada");
      else setVerifyMessage(error instanceof Error ? error.message : "No se pudo verificar la orden");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-semibold"><ShieldCheck className="h-5 w-5 text-success" />Verificación blockchain</h3>
          <StatusBadge tono="success">Testnet · En vivo</StatusBadge>
        </div>
        <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          <Summary label="Orden" value={`#${order.id}`} />
          <Summary label="Estado" value={STATUS_LABEL[order.status]} />
          <Summary label="Carga" value={`${order.tons} tn ${order.tokenCode}`} />
          <Summary label="Destino" value={order.destination} />
          <Summary label="Incoterm" value={order.incoterm} />
          <Summary label="Total" value={fmtUsd(order.totalCents)} />
          <Summary label="Anticipo" value={fmtUsd(order.advanceCents)} />
          <Summary label="Saldo" value={fmtUsd(order.balanceCents)} />
        </div>
      </Card>

      <EscrowTracker order={order} />

      <Card>
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold"><Fingerprint className="h-5 w-5 text-info" />Historial blockchain</h3>
        <ol className="space-y-4 border-l-2 border-border pl-5">
          {sortEvents(order.events).filter((event) => showHedera || !["SEAL_HEDERA", "SEAL_ERROR"].includes(event.type)).map((event) => {
            const link = eventLink(event);
            return (
              <li key={`${event.type}-${event.createdAt}`} className="relative">
                <span className="absolute -left-[1.7rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{EVENT_LABEL[event.type]}</p>
                      {event.type === "SEAL_ERROR" && <StatusBadge tono="warning">Pendiente</StatusBadge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("es-AR")}</p>
                    {event.note && <p className="mt-1 text-xs text-muted-foreground">{event.note}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {event.txHash && <span className="font-mono text-muted-foreground">{shortHash(event.txHash)}</span>}
                    {link && <a className="inline-flex items-center gap-1 font-medium text-primary hover:underline" href={link} target="_blank" rel="noreferrer">Ver en StellarExpert <ExternalLink className="h-3 w-3" /></a>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {showHedera && <Card>
        <h3 className="mb-3 text-base font-semibold">Sello de integridad</h3>
        {order.seal ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <Summary label="Hash" value={shortHash(order.seal.hash)} mono />
              <Summary label="Topic ID" value={order.seal.topicId} mono />
              <Summary label="Secuencia" value={String(order.seal.sequenceNumber)} />
              <Summary label="Modo" value={order.seal.mode} />
            </div>
            <a className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={order.seal.hashscanUrl} target="_blank" rel="noreferrer">Ver en HashScan <ExternalLink className="h-3 w-3" /></a>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={handleVerify} disabled={verifying}>{verifying ? "Verificando..." : "Verificar integridad"}</Button>
              {verification && <StatusBadge tono={verification.valid ? "success" : "danger"}><CheckCircle2 className="mr-1 h-3 w-3" />{verification.valid ? "Hash coincide" : "No coincide"}</StatusBadge>}
              {verifyMessage && <p className="text-sm text-warning-foreground">{verifyMessage}</p>}
            </div>
          </div>
        ) : order.status === "COMPLETADA" ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Sin sellar</p>
            <Button variant="outline" onClick={handleSeal} disabled={sealing}>{sealing ? "Sellando..." : "Sellar en Hedera"}</Button>
            {sealMessage && <p className="text-sm text-warning-foreground">{sealMessage}</p>}
          </div>
        ) : <p className="text-sm text-muted-foreground">Se sella al completar la liquidación</p>}
      </Card>}

      {health?.issuerPublic && health.escrowPublic && <Card>
        <h3 className="mb-3 text-base font-semibold">Cuentas en Stellar testnet</h3>
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <AccountLink label="Emisor de activos" account={health.issuerPublic} />
          <AccountLink label="Escrow" account={health.escrowPublic} />
        </div>
      </Card>}

      <p className="rounded-lg border border-info/30 bg-info-muted/50 p-3 text-sm text-muted-foreground">Escrow custodial operado por la plataforma. USDC y ARROZ son activos de prueba emitidos por la plataforma en Stellar testnet (no es USDC de Circle). Firma del comprador con billetera propia, multifirma y Soroban: hoja de ruta.</p>
    </div>
  );
}

function Summary({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={mono ? "font-mono text-sm" : "text-sm font-medium"}>{value}</p></div>;
}

function AccountLink({ label, account }: { label: string; account: string }) {
  return <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><a className="inline-flex items-center gap-1 break-all font-mono text-sm text-primary hover:underline" href={`https://stellar.expert/explorer/testnet/account/${account}`} target="_blank" rel="noreferrer">{account}<ExternalLink className="h-3 w-3 shrink-0" /></a></div>;
}

function isVerification(value: unknown): value is Verification {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return typeof result["valid"] === "boolean" && typeof result["hash"] === "string" && typeof result["sealedHash"] === "string" && (typeof result["onChain"] === "boolean" || result["onChain"] === null);
}
