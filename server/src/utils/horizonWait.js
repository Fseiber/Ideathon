const defaultSleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function statusOf(error) {
  return error?.response?.status ?? error?.status;
}

export async function waitForTx(server, hash, { attempts = 10, baseMs = 1000, maxMs = 5000, sleep = defaultSleep } = {}) {
  const horizon = server?.config?.url || server?._serverURL || 'Horizon';

  for (let index = 0; index < attempts; index += 1) {
    try {
      const record = await server.transactions().transaction(hash).call();
      if (record?.successful === false) {
        throw new Error(`TX_FAILED: ${record.result_xdr || 'sin result_xdr'}`);
      }
      return record;
    } catch (error) {
      if (error?.message?.startsWith('TX_FAILED:')) throw error;
      const status = statusOf(error);
      if (status !== 404) console.log(`[horizon] status=${status ?? 'network'} hash=${hash}`);
      if (index === attempts - 1) break;
      await sleep(Math.min(baseMs * (2 ** index), maxMs));
    }
  }

  const error = new Error(`TX_NOT_FOUND: ${hash} en ${horizon} después de ${attempts} intentos`);
  error.code = 'TX_NOT_FOUND';
  throw error;
}
