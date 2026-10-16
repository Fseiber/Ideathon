import dotenv from 'dotenv';
import { Asset, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';

dotenv.config();

const horizonUrl = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const amountArg = process.argv[2] || '200000';

function fail(message) {
  throw new Error(message);
}

function buyerUsdc(account, issuerPublic) {
  return account.balances.find((balance) => balance.asset_code === 'USDC' && balance.asset_issuer === issuerPublic);
}

try {
  if (process.env.STELLAR_MODE !== 'testnet') fail('topupBuyer requiere STELLAR_MODE=testnet');
  if (!horizonUrl.toLowerCase().includes('testnet')) fail(`topupBuyer requiere HORIZON_URL de testnet: ${horizonUrl}`);
  if (!/^\d+$/.test(amountArg)) fail('El monto debe ser un entero positivo en USD');
  const amount = Number(amountArg);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) fail('El monto debe ser un entero positivo menor o igual a 1000000 USD');
  if (!process.env.STELLAR_ISSUER_SECRET || !process.env.STELLAR_ISSUER_PUBLIC || !process.env.STELLAR_BUYER_PUBLIC) fail('Falta configurar las credenciales públicas/secretas de Stellar');

  const server = new Horizon.Server(horizonUrl);
  const issuer = Keypair.fromSecret(process.env.STELLAR_ISSUER_SECRET);
  const asset = new Asset('USDC', process.env.STELLAR_ISSUER_PUBLIC);
  const beforeAccount = await server.loadAccount(process.env.STELLAR_BUYER_PUBLIC);
  const beforeBalance = buyerUsdc(beforeAccount, process.env.STELLAR_ISSUER_PUBLIC);
  if (!beforeBalance) fail('El comprador no tiene trustline USDC del emisor');

  console.log(`Saldo USDC comprador antes: ${beforeBalance.balance}`);
  const issuerAccount = await server.loadAccount(issuer.publicKey());
  const transaction = new TransactionBuilder(issuerAccount, { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: process.env.STELLAR_BUYER_PUBLIC, asset, amount: amount.toFixed(2) }))
    .addMemo(Memo.text('TOPUP'))
    .setTimeout(30)
    .build();
  transaction.sign(issuer);
  const response = await server.submitTransaction(transaction);
  const afterAccount = await server.loadAccount(process.env.STELLAR_BUYER_PUBLIC);
  const afterBalance = buyerUsdc(afterAccount, process.env.STELLAR_ISSUER_PUBLIC);
  console.log(`Hash: ${response.hash}`);
  console.log(`StellarExpert: https://stellar.expert/explorer/testnet/tx/${response.hash}`);
  console.log(`Saldo USDC comprador después: ${afterBalance?.balance || '0'}`);
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : 'No se pudo completar el topup'}`);
  process.exitCode = 1;
}
