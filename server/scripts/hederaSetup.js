import dotenv from 'dotenv';
import fs from 'node:fs';
import { Client, PrivateKey, TopicCreateTransaction } from '@hashgraph/sdk';
dotenv.config();

const envUrl = new URL('../.env', import.meta.url);
const lines = fs.existsSync(envUrl) ? fs.readFileSync(envUrl, 'utf8').split(/\r?\n/) : [];
const values = Object.fromEntries(lines.filter(line => line && !line.startsWith('#')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, '')]; }));
if (values.HEDERA_TOPIC_ID || process.env.HEDERA_TOPIC_ID) { console.log(`HEDERA_TOPIC_ID=${values.HEDERA_TOPIC_ID || process.env.HEDERA_TOPIC_ID}`); process.exit(0); }
const operatorId = values.HEDERA_OPERATOR_ID || process.env.HEDERA_OPERATOR_ID;
const operatorKeyValue = values.HEDERA_OPERATOR_KEY || process.env.HEDERA_OPERATOR_KEY;
if (!operatorId || !operatorKeyValue) throw new Error('Faltan HEDERA_OPERATOR_ID y HEDERA_OPERATOR_KEY');
const key = operatorKeyValue.startsWith('302') ? PrivateKey.fromStringDer(operatorKeyValue) : (process.env.HEDERA_KEY_TYPE || values.HEDERA_KEY_TYPE || 'ECDSA') === 'ED25519' ? PrivateKey.fromStringED25519(operatorKeyValue) : PrivateKey.fromStringECDSA(operatorKeyValue);
const client = Client.forTestnet().setOperator(operatorId, key);
try {
  const response = await new TopicCreateTransaction().setTopicMemo('AgroFlow seals').execute(client);
  const receipt = await response.getReceipt(client);
  values.HEDERA_TOPIC_ID = receipt.topicId.toString();
  fs.writeFileSync(envUrl, Object.entries(values).map(([name, value]) => `${name}=${value}`).join('\n') + '\n');
  console.log(`HEDERA_TOPIC_ID=${values.HEDERA_TOPIC_ID}`);
  console.log(`https://hashscan.io/testnet/topic/${values.HEDERA_TOPIC_ID}`);
} finally { client.close(); }
