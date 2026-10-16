const missingReply = (missing) => `Para cotizar necesito: ${missing.join(', ')}.`;

export async function stubAgent(messages) {
  const text = messages.filter(message => message.role === 'user').map(message => message.content).join(' ');
  const tonsMatch = text.match(/(\d+)\s*(?:tn|t|toneladas?)\b/i);
  const incotermMatch = text.match(/\b(FOB|CFR)\b/i);
  const destinationMatch = text.match(/\b(?:para|hacia|a)\s+([^,.]+?)(?=\s+(?:FOB|CFR)\b|\s+con\b|[,.]|$)/i);
  const missing = [];
  if (!tonsMatch) missing.push('toneladas');
  if (!destinationMatch || !destinationMatch[1].trim()) missing.push('destino');
  if (!incotermMatch) missing.push('Incoterm (FOB o CFR)');
  if (missing.length) return { reply: missingReply(missing), intent: null };
  return { reply: '¡Perfecto! Te armo la cotización.', intent: { tons: Number(tonsMatch[1]), destination: destinationMatch[1].trim(), incoterm: incotermMatch[1].toUpperCase() } };
}

export default stubAgent;
