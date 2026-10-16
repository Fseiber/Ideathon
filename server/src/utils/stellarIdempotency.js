import { AppError } from './errors.js';

export const TX_TIMEOUT_S = 30;
const defaultSleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function findTxByMemo({ horizon, sourcePublicKey, memo, limit = 100 }) {
  const response = await horizon.transactions().forAccount(sourcePublicKey).order('desc').limit(limit).call();
  const records = response?.records || [];
  const found = records.find(record => record.memo_type === 'text' && record.memo === memo && record.source_account === sourcePublicKey && record.successful === true);
  return found ? { hash: found.hash } : null;
}

export function isAmbiguous(error) {
  const status = error?.response?.status;
  return !error?.response || [502, 503, 504].includes(status);
}

export async function submitIdempotent({ horizon, buildAndSign, sourcePublicKey, memo, sleep = defaultSleep, now = Date.now, pollMs = 3000 }) {
  const existing = await findTxByMemo({ horizon, sourcePublicKey, memo });
  if (existing) return { txHash: existing.hash, reconciled: true };
  const tx = await buildAndSign();
  const deadline = now() + (TX_TIMEOUT_S + 15) * 1000;
  try {
    const response = await horizon.submitTransaction(tx);
    return { txHash: response.hash, reconciled: false };
  } catch (error) {
    if (!isAmbiguous(error)) throw new AppError('STELLAR_ERROR', 'Error en la red Stellar', 502);
    console.warn(`[stellar] resultado incierto memo=${memo}; verificando…`);
    while (now() < deadline) {
      try {
        const found = await findTxByMemo({ horizon, sourcePublicKey, memo });
        if (found) return { txHash: found.hash, reconciled: true };
      } catch { /* Horizon can be temporarily unavailable while reconciling. */ }
      await sleep(pollMs);
    }
    throw new AppError('STELLAR_ERROR', 'La transacción no se confirmó en Stellar; es seguro reintentar', 502);
  }
}
