import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { Asset, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { AppError } from '../utils/errors.js';
import { submitIdempotent, TX_TIMEOUT_S } from '../utils/stellarIdempotency.js';
dotenv.config();

const mode = process.env.STELLAR_MODE || 'mock';
if (process.env.STELLAR_NETWORK && process.env.STELLAR_NETWORK !== 'testnet') throw new Error('Sólo se admite Stellar testnet');
export const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
if (!HORIZON_URL.includes('testnet')) throw new Error('Sólo se admite Horizon testnet');
const server = new Horizon.Server(HORIZON_URL);
let mockCalls = 0;
let failAt = null;
const arrozAsset = () => new Asset('ARROZ', process.env.STELLAR_ISSUER_PUBLIC);
export const getStellarMode = () => process.env.STELLAR_MODE || mode;
export const getMockCallCount = () => mockCalls;
export const resetMockCallCount = () => { mockCalls = 0; failAt = null; };
export const setMockFailureAt = (call) => { failAt = call; };
function mockTransaction() { mockCalls += 1; if (failAt === mockCalls) throw new AppError('STELLAR_ERROR', 'Fallo simulado de Stellar', 502); return { txHash: randomBytes(32).toString('hex') }; }

export async function sendUsdc({ fromSecret, toPublicKey, amountCents, memo }) {
  if (getStellarMode() === 'mock') {
    return mockTransaction();
  }
  try {
    const source = Keypair.fromSecret(fromSecret);
    const result = await submitIdempotent({ horizon: server, sourcePublicKey: source.publicKey(), memo, buildAndSign: async () => {
      const account = await server.loadAccount(source.publicKey());
      const asset = new Asset('USDC', process.env.STELLAR_ISSUER_PUBLIC);
      const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
        .addOperation(Operation.payment({ destination: toPublicKey, asset, amount: (amountCents / 100).toFixed(2) }))
        .addMemo(Memo.text(memo)).setTimeout(TX_TIMEOUT_S).build();
      tx.sign(source);
      return tx;
    } });
    return result;
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError('STELLAR_ERROR', 'Error en la red Stellar', 502); }
}
export async function mintArroz({ toPublicKey, tons }) {
  if (getStellarMode() === 'mock') return mockTransaction();
  try {
    const issuer = Keypair.fromSecret(process.env.STELLAR_ISSUER_SECRET);
    const account = await server.loadAccount(issuer.publicKey());
    const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({ destination: toPublicKey, asset: arrozAsset(), amount: tons.toFixed(7) }))
      .setTimeout(30).build();
    tx.sign(issuer);
    const result = await server.submitTransaction(tx);
    return { txHash: result.hash };
  } catch (error) { throw error instanceof AppError ? error : new AppError('STELLAR_ERROR', 'Error en la red Stellar', 502); }
}
export async function sendArroz({ fromSecret, toPublicKey, tons, memo }) {
  if (getStellarMode() === 'mock') return mockTransaction();
  try {
    const source = Keypair.fromSecret(fromSecret);
    const result = await submitIdempotent({ horizon: server, sourcePublicKey: source.publicKey(), memo, buildAndSign: async () => {
      const account = await server.loadAccount(source.publicKey());
      const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
        .addOperation(Operation.payment({ destination: toPublicKey, asset: arrozAsset(), amount: tons.toFixed(7) }))
        .addMemo(Memo.text(memo)).setTimeout(TX_TIMEOUT_S).build();
      tx.sign(source);
      return tx;
    } });
    return result;
  } catch (error) { throw error instanceof AppError ? error : new AppError('STELLAR_ERROR', 'Error en la red Stellar', 502); }
}
export async function settleDvP({ memo, usdcCents, usdcTo, arrozTons, arrozTo }) {
  if (getStellarMode() === 'mock') return mockTransaction();
  try {
    const escrow = Keypair.fromSecret(process.env.STELLAR_ESCROW_SECRET);
    const result = await submitIdempotent({ horizon: server, sourcePublicKey: escrow.publicKey(), memo, buildAndSign: async () => {
      const account = await server.loadAccount(escrow.publicKey());
      const usdc = new Asset('USDC', process.env.STELLAR_ISSUER_PUBLIC);
      const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
        .addOperation(Operation.payment({ destination: usdcTo, asset: usdc, amount: (usdcCents / 100).toFixed(2) }))
        .addOperation(Operation.payment({ destination: arrozTo, asset: arrozAsset(), amount: arrozTons.toFixed(7) }))
        .addMemo(Memo.text(memo)).setTimeout(TX_TIMEOUT_S).build();
      tx.sign(escrow);
      return tx;
    } });
    return result;
  } catch (error) { throw error instanceof AppError ? error : new AppError('STELLAR_ERROR', 'Error en la red Stellar', 502); }
}
export const explorerUrl = (hash) => hash ? `https://stellar.expert/explorer/testnet/tx/${hash}` : null;
