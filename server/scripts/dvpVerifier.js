export function amountToCents(value) {
  const [integer, decimal = ''] = String(value).split('.');
  const stroops = BigInt(integer + decimal.padEnd(7, '0').slice(0, 7));
  if (stroops % 100000n !== 0n) throw new Error(`Monto con fracción de centavo: ${value}`);
  return Number(stroops / 100000n);
}

function mismatch(field, expected, received, operation) {
  throw new Error(`[smoke] DvP mismatch campo=${field} esperado=${expected} recibido=${received} op=${operation?.id || 'sin-id'}`);
}

function compare(operation, field, expected, received) {
  if (received !== expected) mismatch(field, expected, received, operation);
}

export function verifyDvpOps(records, expected) {
  if (!records || records.length === 0) throw new Error('TX sin operaciones');
  if (records.length !== 2) mismatch('operations.length', 2, records.length, records[0]);

  for (const operation of records) {
    compare(operation, 'type', 'payment', operation.type);
    compare(operation, 'transaction_successful', true, operation.transaction_successful);
    compare(operation, 'from', expected.escrowPublicKey, operation.from);
    if (operation.asset_issuer !== expected.assetIssuer) mismatch('asset_issuer', expected.assetIssuer, operation.asset_issuer, operation);

    if (operation.asset_code === expected.usdcCode) {
      compare(operation, 'USDC.to', expected.millPublicKey, operation.to);
      compare(operation, 'USDC.amount', expected.balanceCents, amountToCents(operation.amount));
    } else if (operation.asset_code === expected.arrozCode) {
      compare(operation, 'ARROZ.to', expected.buyerPublicKey, operation.to);
      compare(operation, 'ARROZ.amount', expected.tons * 100, amountToCents(operation.amount));
    } else {
      mismatch('asset_code', `${expected.usdcCode}|${expected.arrozCode}`, operation.asset_code, operation);
    }
  }
  return true;
}
