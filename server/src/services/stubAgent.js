import { parseMessage, resolveIntent } from './intentParser.js';

export async function stubAgent(messages) {
  const lastUser = [...messages].reverse().find(message => message.role === 'user');
  const current = parseMessage(lastUser?.content || '');
  const resolved = resolveIntent(messages);
  if (resolved.ambiguous) return { reply: `Tu pedido tiene más de un valor de ${resolved.ambiguous}. ¿Me confirmás uno solo?`, intent: null };
  if (!resolved.intent && current.tonsValues.length === 0 && current.incoterms.length === 0 && !current.destination) {
    if (String(lastUser?.content || '').trim().toLowerCase() === 'hola') return { reply: 'Para cotizar necesito: toneladas, destino, Incoterm (FOB o CFR).', intent: null };
    return { reply: 'Puedo cotizar arroz para vos. El pago se hace con USDC de prueba depositado en garantía en Stellar testnet. Decime toneladas, destino e Incoterm (FOB o CFR).', intent: null };
  }
  const legacyQuestions = messages.some(message => message.role === 'assistant' && ['¿A dónde?', '¿Incoterm?'].includes(message.content));
  if (!resolved.intent && legacyQuestions && !messages.some(message => message.role === 'assistant' && message.content.includes('Cotización:'))) {
    const legacy = messages.filter(message => message.role === 'user').map(message => parseMessage(message.content));
    const tons = legacy.flatMap(value => value.tonsValues)[0];
    const destination = legacy.find(value => value.destination)?.destination;
    const incoterm = legacy.flatMap(value => value.incoterms)[0];
    if (tons && destination && incoterm) return { reply: '¡Perfecto! Te armo la cotización.', intent: { tons, destination, incoterm } };
  }
  if (!resolved.intent) return { reply: `Para cotizar necesito: ${resolved.missing.join(', ')}.`, intent: null };
  return { reply: '¡Perfecto! Te armo la cotización.', intent: resolved.intent };
}

export default stubAgent;
