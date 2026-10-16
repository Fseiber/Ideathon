const destinationCut = /[,.;:?!¿!\n]|\b(?:FOB|CFR|con|por|en|y|máximo|maximo|precio|pago|USDC)\b|\bde\s+\d/i;
const forbiddenDestination = /(?:toneladas|tn|quiero|necesito|USDC|FOB|CFR)/i;

export function parseMessage(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  const tonsValues = [...normalized.matchAll(/(\d{1,6})\s*(?:tn|t|ton|toneladas?)\b/gi)].map(match => Number(match[1]));
  for (const match of normalized.matchAll(/(\d{1,6})\s+o\s+(\d{1,6})\s*(?:tn|t|ton|toneladas?)\b/gi)) tonsValues.push(Number(match[1]), Number(match[2]));
  const distinctTons = tonsValues.filter((value, index, values) => values.indexOf(value) === index);
  const incoterms = [...normalized.matchAll(/\b(FOB|CFR)\b/gi)].map(match => match[1].toUpperCase()).filter((value, index, values) => values.indexOf(value) === index);
  let destination = null;
  const namedDestination = /\b(?:para|hacia|destino:?)\s+/i.exec(normalized);
  const aDestination = /\ba\s+[A-ZÁÉÍÓÚÑ][^\s]*/u.exec(normalized);
  const start = namedDestination ? namedDestination.index + namedDestination[0].length : aDestination ? aDestination.index + 2 : -1;
  if (start >= 0) {
    const candidate = normalized.slice(start).split(destinationCut)[0].trim();
    if (candidate.length >= 2 && candidate.length <= 40 && !/\d/.test(candidate) && !forbiddenDestination.test(candidate)) destination = candidate;
  }
  return { tonsValues: distinctTons, incoterms, destination, isQuestion: /[?¿]/.test(String(text || '')) };
}

export function resolveIntent(messages) {
  const lastIndex = messages.map(message => message.role).lastIndexOf('user');
  const last = lastIndex >= 0 ? messages[lastIndex] : null;
  const current = parseMessage(last?.content || '');
  const ambiguous = current.tonsValues.length > 1 ? 'toneladas' : current.incoterms.length > 1 ? 'Incoterm' : null;
  let tons = current.tonsValues[0];
  let incoterm = current.incoterms[0];
  let destination = current.destination;
  const previousAssistant = lastIndex > 0 ? messages[lastIndex - 1] : null;
  const previousUser = lastIndex > 1 ? messages[lastIndex - 2] : null;
  const canContinue = previousAssistant?.role === 'assistant' && previousAssistant.content.startsWith('Para cotizar necesito') && previousUser?.role === 'user';
  if (canContinue) {
    const previous = parseMessage(previousUser.content);
    const previousAmbiguous = previous.tonsValues.length > 1 || previous.incoterms.length > 1;
    if (!previousAmbiguous) {
      if (tons === undefined) tons = previous.tonsValues[0];
      if (!incoterm) incoterm = previous.incoterms[0];
      if (!destination) destination = previous.destination;
    }
  }
  const missing = [];
  if (tons === undefined) missing.push('toneladas');
  if (!destination) missing.push('destino');
  if (!incoterm) missing.push('Incoterm (FOB o CFR)');
  const intent = ambiguous === null && Number.isInteger(tons) && tons >= 1 && tons <= 100000 && destination && incoterm ? { tons, destination, incoterm } : null;
  return { intent, missing, ambiguous };
}
