export function quote({ tons, pricePerTonCents, incoterm, freightCents = 0, exportDutyPct = 0, advancePct = 30 }) {
  const subtotalCents = Math.round(tons * pricePerTonCents);
  const actualFreight = incoterm === 'CFR' ? freightCents : 0;
  const totalCents = subtotalCents + actualFreight;
  const exportDutyCents = Math.round(subtotalCents * exportDutyPct / 100);
  const advanceCents = Math.round(totalCents * advancePct / 100);
  return { subtotalCents, freightCents: actualFreight, totalCents, exportDutyCents, advanceCents, balanceCents: totalCents - advanceCents, millNetCents: totalCents - actualFreight - exportDutyCents };
}
