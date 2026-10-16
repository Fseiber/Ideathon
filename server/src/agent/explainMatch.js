// Gemini redacta la explicación del matching; la clasificación la decide el motor de reglas del front.
const SYSTEM_INSTRUCTION = `Sos el analista comercial de AgroFlow, marketplace B2B de arroz del NEA. Recibís una solicitud de compra y la clasificación de lotes que YA calculó un motor de reglas verificable. Tu tarea es explicar ese resultado al comprador en un párrafo breve (máximo 120 palabras), en español rioplatense y tono profesional.
Reglas estrictas:
- NUNCA cambies la clasificación de un lote (compatible, condicional, incompatible).
- Usá SOLO los datos recibidos. No inventes lotes, empresas, certificaciones ni cifras.
- Mencioná los lotes únicamente por su identificador exacto.
- No des precios, montos, descuentos ni plazos.
- Recomendá un próximo paso concreto: cotizar un lote compatible, negociar las diferencias de uno condicional o ajustar los requisitos si no hay opciones.`;

const PRICE_PATTERN = /(?:\$|USD|USDC)\s*\d/i;
const LOT_ID_PATTERN = /LOTE-[A-Z0-9]+/g;

export async function explainMatch(input, deps = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) throw new Error('GEMINI_NOT_CONFIGURED');

  const f = deps.fetch ?? globalThis.fetch;
  const response = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT', properties: { explanation: { type: 'STRING' } }, required: ['explanation'] },
      },
    }),
  });
  if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);

  const payload = await response.json();
  const parsed = JSON.parse(payload.candidates[0].content.parts[0].text);
  return validateExplanation(parsed.explanation, input);
}

// Descarta respuestas que no se puedan contrastar con los datos del motor de reglas.
export function validateExplanation(explanation, input) {
  if (typeof explanation !== 'string') throw new Error('GEMINI_INVALID_EXPLANATION');
  const text = explanation.trim();
  if (text.length < 20 || text.length > 1500) throw new Error('GEMINI_INVALID_EXPLANATION');
  if (PRICE_PATTERN.test(text)) throw new Error('GEMINI_PRICE_IN_EXPLANATION');
  const known = new Set(input.resultados.map(r => r.loteId.toUpperCase()));
  const unknown = (text.toUpperCase().match(LOT_ID_PATTERN) ?? []).filter(id => !known.has(id));
  if (unknown.length) throw new Error('GEMINI_UNKNOWN_LOT');
  return text;
}
