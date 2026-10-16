import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CONFIRMATION_CHANNELS, RESERVATION_STATUS_LABEL, canWriteReservations, type ConfirmationChannel, type Reservation, type ReservationStatus } from "@/lib/comex-api";
import { Card, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

export const RESERVATION_NOTICE = "Una reserva solicitada no compromete stock. Solo la confirmación del molino lo reserva hasta su vencimiento.";
const TONO: Record<ReservationStatus, "info" | "success" | "neutral" | "danger" | "warning"> = { SOLICITADA: "info", CONFIRMADA: "success", LIBERADA: "neutral", VENCIDA: "danger", CONSUMIDA: "warning" };
const inp = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm";
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function expiresIn(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Vencida";
  const hours = Math.floor(ms / 3600000);
  return hours >= 24 ? `${Math.floor(hours / 24)} d ${hours % 24} h` : `${hours} h ${Math.floor((ms % 3600000) / 60000)} min`;
}

export function ReservationsSection({ requestId, requestTons, canRequest }: { requestId: number; requestTons: number; canRequest: boolean }) {
  const { user, client } = useAuth();
  const canWrite = canWriteReservations(user);
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<number | null>(null);
  const [releasing, setReleasing] = useState<number | null>(null);
  const reservationsQuery = useQuery({ queryKey: ["comex", "requests", requestId, "reservations"], queryFn: () => client.listReservations(requestId) });
  // Reservar cambia la disponibilidad comercial: refrescar reservas, Matching y lotes (Marketplace).
  const refresh = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["comex", "requests", requestId] }), queryClient.invalidateQueries({ queryKey: ["lots"] })]); };
  const fromProposal = useMutation({
    mutationFn: () => client.reserveFromProposal(requestId),
    onSuccess: async (r) => { toast.success(r.created.length ? `${r.created.length} reserva(s) solicitada(s)` : "Las reservas de la propuesta ya estaban solicitadas"); await refresh(); },
    onError: (e) => toast.error(errorText(e, "No se pudieron solicitar las reservas")),
  });

  const data = reservationsQuery.data;
  const confirmedTons = data?.confirmedTons ?? 0;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Reservas</h2>
        {canWrite && canRequest && <Button size="sm" disabled={fromProposal.isPending} onClick={() => fromProposal.mutate()}>Solicitar reservas de la propuesta</Button>}
      </div>
      <p className="mb-3 text-sm font-medium">Reservado y confirmado: {confirmedTons} de {requestTons} tn</p>
      <p role="note" className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{RESERVATION_NOTICE}</p>
      {reservationsQuery.isError && <p className="text-sm text-destructive">No se pudieron cargar las reservas.</p>}
      {data && data.reservations.length === 0 && <p className="text-sm text-muted-foreground">Sin reservas todavía.</p>}
      {data && data.reservations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3">Lote</th><th className="py-2 pr-3">Molino</th><th className="py-2 pr-3">Toneladas</th><th className="py-2 pr-3">Estado</th><th className="py-2 pr-3">Vence en</th><th className="py-2 pr-3">Confirmación</th><th className="py-2" /></tr></thead>
            <tbody>
              {data.reservations.map((r) => (
                <ReservationRow key={r.id} reservation={r} canWrite={canWrite} confirming={confirming === r.id} releasing={releasing === r.id}
                  onConfirm={() => { setReleasing(null); setConfirming(confirming === r.id ? null : r.id); }}
                  onRelease={() => { setConfirming(null); setReleasing(releasing === r.id ? null : r.id); }}
                  onDone={async () => { setConfirming(null); setReleasing(null); await refresh(); }} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ReservationRow({ reservation: r, canWrite, confirming, releasing, onConfirm, onRelease, onDone }: { reservation: Reservation; canWrite: boolean; confirming: boolean; releasing: boolean; onConfirm: () => void; onRelease: () => void; onDone: () => Promise<void> }) {
  const active = r.status === "SOLICITADA" || r.status === "CONFIRMADA";
  return (
    <>
      <tr className="border-b border-border/60 align-top">
        <td className="py-2 pr-3"><a href={`/lotes/${r.lotId}`} className="text-primary hover:underline">#{r.lotId}</a></td>
        <td className="pr-3">{r.lot.supplier?.name ?? "Molino no vinculado"}</td>
        <td className="pr-3">{r.tons} tn</td>
        <td className="pr-3"><StatusBadge tono={TONO[r.status]}>{RESERVATION_STATUS_LABEL[r.status]}</StatusBadge>{r.releaseReason && <p className="mt-1 text-xs text-muted-foreground">{r.releaseReason}</p>}</td>
        <td className="pr-3">{active ? expiresIn(r.expiresAt) : "—"}</td>
        <td className="pr-3 text-xs">{r.confirmedBy ? <><p>{r.confirmedBy.name} · {CONFIRMATION_CHANNELS.find((c) => c.id === r.confirmationChannel)?.label ?? r.confirmationChannel}</p><p className="text-muted-foreground">{r.confirmationContact}{r.confirmationReference ? ` · ${r.confirmationReference}` : ""}</p></> : "—"}</td>
        <td className="whitespace-nowrap">{canWrite && active && <div className="flex gap-1">{r.status === "SOLICITADA" && <Button size="sm" variant="outline" onClick={onConfirm}>Confirmar</Button>}<Button size="sm" variant="outline" onClick={onRelease}>Liberar</Button></div>}</td>
      </tr>
      {confirming && <tr><td colSpan={7} className="pb-3"><ConfirmForm reservation={r} onDone={onDone} /></td></tr>}
      {releasing && <tr><td colSpan={7} className="pb-3"><ReleaseForm reservation={r} onDone={onDone} /></td></tr>}
    </>
  );
}

function ConfirmForm({ reservation, onDone }: { reservation: Reservation; onDone: () => Promise<void> }) {
  const { client } = useAuth();
  const [channel, setChannel] = useState<ConfirmationChannel>("WHATSAPP");
  const [contact, setContact] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const confirm = useMutation({
    mutationFn: () => client.confirmReservation(reservation.id, { channel, contact, reference: reference || null }),
    onSuccess: async () => { toast.success(`Reserva de ${reservation.tons} tn confirmada en el lote #${reservation.lotId}`); await onDone(); },
    onError: (e) => setError(errorText(e, "No se pudo confirmar la reserva")),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); setError(null); confirm.mutate(); };
  return (
    <form onSubmit={submit} aria-label={`Confirmar reserva ${reservation.id}`} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-4">
      <label className="space-y-1 text-xs"><span>Canal</span><select className={inp} value={channel} onChange={(e) => setChannel(e.target.value as ConfirmationChannel)}>{CONFIRMATION_CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      <label className="space-y-1 text-xs"><span>Contacto del molino</span><input className={inp} value={contact} onChange={(e) => setContact(e.target.value)} required minLength={2} maxLength={120} /></label>
      <label className="space-y-1 text-xs"><span>Referencia (opcional)</span><input className={inp} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} /></label>
      <div className="flex items-end"><Button type="submit" size="sm" className="w-full" disabled={confirm.isPending}>Confirmar reserva</Button></div>
      {error && <p role="alert" className="text-xs text-destructive sm:col-span-4">{error}</p>}
    </form>
  );
}

function ReleaseForm({ reservation, onDone }: { reservation: Reservation; onDone: () => Promise<void> }) {
  const { client } = useAuth();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const release = useMutation({
    mutationFn: () => client.releaseReservation(reservation.id, reason),
    onSuccess: async () => { toast.success(`Reserva del lote #${reservation.lotId} liberada`); await onDone(); },
    onError: (e) => setError(errorText(e, "No se pudo liberar la reserva")),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(null); release.mutate(); }} aria-label={`Liberar reserva ${reservation.id}`} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <label className="min-w-[240px] flex-1 space-y-1 text-xs"><span>Motivo de liberación</span><input className={inp} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={2} maxLength={200} /></label>
      <Button type="submit" size="sm" variant="outline" disabled={release.isPending}>Liberar reserva</Button>
      {error && <p role="alert" className="w-full text-xs text-destructive">{error}</p>}
    </form>
  );
}
