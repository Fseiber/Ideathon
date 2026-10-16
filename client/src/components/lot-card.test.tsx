import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LotCard } from "./lot-card";

const lot = { id: 7, product: "Arroz largo fino", variety: "Largo fino", province: "Corrientes", presentation: "Bolsas 25 kg", brokenPct: 5, moisturePct: 13, pricePerTonCents: 60000, tonsTotal: 1000, tonsAvailable: 980, mintTxHash: "a".repeat(64), explorerUrl: "https://stellar.expert/explorer/testnet/tx/a", createdAt: "2026-01-01T00:00:00.000Z" };

describe("LotCard", () => {
  it("shows availability and tokenized supply", () => {
    render(<LotCard lot={lot} />);
    expect(screen.getByText("980 de 1000 tn disponibles")).toBeInTheDocument();
    expect(screen.getByText("Tokenizado en Stellar · 1000 ARROZ")).toBeInTheDocument();
  });

  it("omits the mint link when there is no explorer URL", () => {
    render(<LotCard lot={{ ...lot, explorerUrl: null }} />);
    expect(screen.queryByText("Ver emisión")).not.toBeInTheDocument();
  });
});
