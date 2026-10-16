import { api, type ApiEvent, type ApiLot, type ApiOrder } from "./api";
import { EVENT_LABEL, eventLink } from "./order-view";

export type ReceiptParty = { id: number; name: string; role: string; stellarPublicKey: string };
export const getParties = () => api<ReceiptParty[]>("/parties");

export function buildReceipt(order: ApiOrder, lot: ApiLot | undefined, parties: ReceiptParty[]) {
  if (order.status !== "COMPLETADA") return null;
  const persisted = order as ApiOrder & { millId: number; buyerId: number };
  const seller = parties.find((party) => party.id === persisted.millId);
  const buyer = parties.find((party) => party.id === persisted.buyerId);
  const settled = order.events?.find((event) => event.type === "SETTLE_DVP");
  const transactionTypes: ApiEvent["type"][] = ["FUND_ESCROW", "LOCK_TOKENS", "RELEASE_ADVANCE", "SETTLE_DVP"];
  return {
    number: order.id,
    settledAt: settled?.createdAt ?? null,
    seller: seller ? { name: seller.name, stellarPublicKey: seller.stellarPublicKey } : null,
    buyer: buyer ? { name: buyer.name, stellarPublicKey: buyer.stellarPublicKey } : null,
    lot: lot ? { id: lot.id, product: lot.product, variety: lot.variety, province: lot.province, presentation: lot.presentation, brokenPct: lot.brokenPct, moisturePct: lot.moisturePct } : { id: order.lotId },
    commercial: { tons: order.tons, incoterm: order.incoterm, destination: order.destination, pricePerTonCents: order.pricePerTonCents, subtotalCents: order.subtotalCents, freightCents: order.freightCents, totalCents: order.totalCents, advanceCents: order.advanceCents, balanceCents: order.balanceCents, exportDutyPct: order.exportDutyPct, exportDutyCents: order.exportDutyCents },
    transactions: transactionTypes.map((type) => order.events?.find((event) => event.type === type && event.txHash)).filter((event): event is ApiEvent => Boolean(event)).map((event) => ({ label: EVENT_LABEL[event.type], txHash: event.txHash as string, url: eventLink(event) })),
  };
}
