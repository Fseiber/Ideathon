import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ApiOrder } from "@/lib/api";
import { EscrowTracker } from "./escrow-tracker";

const order: ApiOrder = { id: "order", status: "COMPLETADA", lotId: 1, tokenCode: "ARROZ", destination: "Asunción", tons: 20, incoterm: "CFR", subtotalCents: 1200000, pricePerTonCents: 60000, freightCents: 150000, exportDutyPct: 5, exportDutyCents: 60000, totalCents: 1350000, advanceCents: 405000, balanceCents: 945000, events: ["FUND_ESCROW", "LOCK_TOKENS", "RELEASE_ADVANCE", "SETTLE_DVP"].map((type, index) => ({ type: type as ApiOrder["events"][number]["type"], txHash: `${index + 1}`.repeat(64), explorerUrl: null, note: null, createdAt: `2026-01-0${index + 1}` })), seal: null };

it("renders four Stellar transaction links and one simulated badge", () => { render(<EscrowTracker order={order} />); expect(screen.getAllByRole("link", { name: /Ver tx/ })).toHaveLength(4); expect(screen.getByText("Simulado")).toBeInTheDocument(); });
