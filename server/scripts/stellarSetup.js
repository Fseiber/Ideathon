import dotenv from 'dotenv'; dotenv.config();
import fs from 'node:fs';
import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
const envPath = new URL('../.env', import.meta.url); const lines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
const values = Object.fromEntries(lines.filter(x => x && !x.startsWith('#')).map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).replace(/^"|"$/g, '')]; }));
const make = (name) => { if (values[`STELLAR_${name}_SECRET`]) return; const kp = Keypair.random(); values[`STELLAR_${name}_SECRET`] = kp.secret(); values[`STELLAR_${name}_PUBLIC`] = kp.publicKey(); };
['ISSUER', 'ESCROW', 'MILL', 'BUYER'].forEach(make); values.STELLAR_ISSUER_PUBLIC = values.STELLAR_ISSUER_PUBLIC || Keypair.fromSecret(values.STELLAR_ISSUER_SECRET).publicKey();
fs.writeFileSync(envPath, Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
const server = new Horizon.Server('https://horizon-testnet.stellar.org');
for (const name of ['ISSUER', 'ESCROW', 'MILL', 'BUYER']) { try { await fetch(`https://friendbot.stellar.org?addr=${values[`STELLAR_${name}_PUBLIC`]}`); } catch { /* already funded or unavailable */ } }
const issuer = Keypair.fromSecret(values.STELLAR_ISSUER_SECRET); const asset = new Asset('USDC', issuer.publicKey()); const arroz = new Asset('ARROZ', issuer.publicKey());
for (const name of ['ESCROW', 'MILL', 'BUYER']) { const kp = Keypair.fromSecret(values[`STELLAR_${name}_SECRET`]); const account = await server.loadAccount(kp.publicKey()); const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET }).addOperation(Operation.changeTrust({ asset })).addOperation(Operation.changeTrust({ asset: arroz })).setTimeout(30).build(); tx.sign(kp); try { await server.submitTransaction(tx); } catch { /* idempotent */ } }
const buyer = Keypair.fromSecret(values.STELLAR_BUYER_SECRET); const account = await server.loadAccount(issuer.publicKey()); const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET }).addOperation(Operation.payment({ destination: buyer.publicKey(), asset, amount: '100000.00' })).setTimeout(30).build(); tx.sign(issuer); try { await server.submitTransaction(tx); } catch { /* already issued */ }
console.log('Stellar testnet configurado.'); for (const n of ['ISSUER', 'ESCROW', 'MILL', 'BUYER']) console.log(`${n}: ${values[`STELLAR_${n}_PUBLIC`]}`);
