import dotenv from 'dotenv';
import { Client, PrivateKey, TopicMessageSubmitTransaction } from '@hashgraph/sdk';
import { AppError } from '../utils/errors.js';
dotenv.config();

const mode = process.env.HEDERA_MODE || 'mock';
let mockCalls = 0;
let mockSequence = 0;
let failAt = null;
export const getHederaMode = () => process.env.HEDERA_MODE || mode;
export const getHederaMockCallCount = () => mockCalls;
export const resetHederaMock = () => { mockCalls = 0; mockSequence = 0; failAt = null; };
export const setHederaMockFailureAt = (call) => { failAt = call; };

function mockSubmit() {
  mockCalls += 1;
  if (failAt === mockCalls) throw new AppError('HEDERA_ERROR', 'Fallo simulado de Hedera', 502);
  mockSequence += 1;
  return { topicId: '0.0.0000001', sequenceNumber: mockSequence };
}
function requiredConfig() {
  for (const key of ['HEDERA_OPERATOR_ID', 'HEDERA_OPERATOR_KEY', 'HEDERA_TOPIC_ID']) if (!process.env[key]) throw new AppError('HEDERA_ERROR', `Falta configurar ${key}`, 502);
}
function operatorKey() {
  const value = process.env.HEDERA_OPERATOR_KEY;
  if (value.startsWith('302')) return PrivateKey.fromStringDer(value);
  return (process.env.HEDERA_KEY_TYPE || 'ECDSA') === 'ED25519' ? PrivateKey.fromStringED25519(value) : PrivateKey.fromStringECDSA(value);
}
export async function submitSeal({ message }) {
  const currentMode = getHederaMode();
  if (currentMode === 'mock') return mockSubmit();
  if (currentMode === 'off') throw new AppError('HEDERA_ERROR', 'Hedera está desactivado', 502);
  try {
    requiredConfig();
    const client = Client.forTestnet().setOperator(process.env.HEDERA_OPERATOR_ID, operatorKey());
    try {
      const response = await Promise.race([
        new TopicMessageSubmitTransaction().setTopicId(process.env.HEDERA_TOPIC_ID).setMessage(message).execute(client),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de Hedera')), 15000))
      ]);
      const receipt = await response.getReceipt(client);
      return { topicId: receipt.topicId.toString(), sequenceNumber: receipt.topicSequenceNumber.toNumber() };
    } finally { client.close(); }
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError('HEDERA_ERROR', 'Error en Hedera', 502); }
}
export function hashscanUrl(topicId, sequenceNumber) { return `https://hashscan.io/testnet/topic/${topicId}/message/${sequenceNumber}`; }
export async function fetchMirrorMessage(topicId, sequenceNumber) {
  if (getHederaMode() === 'mock' || getHederaMode() === 'off') return null;
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages/${sequenceNumber}`, { signal: controller.signal });
    if (!response.ok) return null;
    const body = await response.json();
    return body.message ? Buffer.from(body.message, 'base64').toString('utf8') : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
