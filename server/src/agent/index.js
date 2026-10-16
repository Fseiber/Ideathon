const SYSTEM_INSTRUCTION = `Sos el asistente comercial de AgroFlow, marketplace B2B de arroz del NEA. Tu ÚNICA tarea es entender el pedido del comprador y extraer: toneladas (entero), destino (ciudad o país) e Incoterm (FOB o CFR). NUNCA des precios, montos, descuentos ni plazos: los calcula el sistema. Si falta algún dato, pedilo amablemente y devolvé intent null. Si el pedido no es de arroz, explicá que sólo cotizás arroz y devolvé intent null. Respondé breve, en español rioplatense. Interpretá SOLO el último mensaje del comprador como la solicitud actual. Si trae una solicitud nueva, ignorá por completo pedidos anteriores. Usá mensajes previos solo si el último mensaje responde a una pregunta tuya sobre un dato faltante. Si hay valores contradictorios o más de uno para un campo, devolvé intent null y pedí confirmación. El destino es solo el nombre del lugar (ej. 'Brasil').`;
const PRICE_PATTERN = /(?:\$|USD|USDC)\s*\d/i;

export async function runAgent(messages, deps = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) throw new Error('GEMINI_NOT_CONFIGURED');

  const f = deps.fetch ?? globalThis.fetch;
  const response = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: messages.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            reply: { type: 'STRING' },
            intent: {
              type: 'OBJECT',
              nullable: true,
              properties: {
                tons: { type: 'INTEGER' },
                destination: { type: 'STRING' },
                incoterm: { type: 'STRING', enum: ['FOB', 'CFR'] },
              },
              required: ['tons', 'destination', 'incoterm'],
            },
          },
          required: ['reply', 'intent'],
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);

  const payload = await response.json();
  const text = payload.candidates[0].content.parts[0].text;
  const parsed = JSON.parse(text);
  if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) throw new Error('GEMINI_INVALID_REPLY');

  let reply = parsed.reply;
  if (PRICE_PATTERN.test(reply)) reply = 'Perfecto, te preparo la cotización con los valores del sistema.';
  return { reply, intent: normalizeIntent(parsed.intent) };
}

function normalizeIntent(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const tons = Number(value.tons);
  if (!Number.isInteger(tons) || tons < 1 || tons > 100000) return null;
  if (typeof value.destination !== 'string') return null;
  const destination = value.destination.trim();
  if (destination.length < 2 || destination.length > 80) return null;
  if (typeof value.incoterm !== 'string') return null;
  const incoterm = value.incoterm.toUpperCase();
  if (!['FOB', 'CFR'].includes(incoterm)) return null;
  return { tons, destination, incoterm };
}
