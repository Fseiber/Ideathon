import { eventLink } from "./order-view";
import type { ApiEvent, ApiOrder } from "./api";

export function escrowView(order: ApiOrder) {
  const events = order.events ?? [];
  const findEvent = (type: ApiEvent["type"]) => events.find((event) => event.type === type);
  const has = (type: ApiEvent["type"]) => Boolean(findEvent(type));
  const stage = (value: { key: string; label: string; amountCents?: number; asset?: string; tons?: number; done: boolean; onChain: boolean; event?: ApiEvent["type"] }) => {
    const event = value.event ? findEvent(value.event) : undefined;
    return { ...value, txHash: event?.txHash ?? null, link: event ? eventLink(event) : null };
  };
  const stages = [
    stage({ key: "fund", label: "Pago depositado en garantía", amountCents: order.totalCents, asset: "USDC de prueba", done: has("FUND_ESCROW"), onChain: true, event: "FUND_ESCROW" }),
    stage({ key: "lock", label: "Tokens ARROZ bloqueados en escrow", tons: order.tons, done: has("LOCK_TOKENS"), onChain: true, event: "LOCK_TOKENS" }),
    stage({ key: "advance", label: "Anticipo 30% liberado al molino", amountCents: order.advanceCents, done: has("RELEASE_ADVANCE"), onChain: true, event: "RELEASE_ADVANCE" }),
    stage({ key: "dispatch", label: "Despacho y entrega", done: has("DISPATCHED"), onChain: false }),
    stage({ key: "settle", label: "Liquidación DvP: saldo → molino · ARROZ → comprador", amountCents: order.balanceCents, tons: order.tons, done: has("SETTLE_DVP"), onChain: true, event: "SETTLE_DVP" }),
  ];
  return {
    stages,
    heldCents: has("RELEASE_ADVANCE") && !has("SETTLE_DVP") ? order.balanceCents : has("FUND_ESCROW") && !has("RELEASE_ADVANCE") ? order.totalCents : 0,
    tokensHeld: has("LOCK_TOKENS") && !has("SETTLE_DVP") ? order.tons : 0,
    releasedToMillCents: (has("RELEASE_ADVANCE") ? order.advanceCents : 0) + (has("SETTLE_DVP") ? order.balanceCents : 0),
    processing: order.status === "PROCESANDO",
  };
}
