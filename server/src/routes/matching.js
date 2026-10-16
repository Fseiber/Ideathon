import { Router } from 'express';
import { AppError } from '../utils/errors.js';

const RESULTADOS = ['compatible', 'condicional', 'incompatible'];

function text(value, field, max = 200) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) throw new AppError('VALIDATION_ERROR', `${field} debe tener entre 1 y ${max} caracteres`);
  return value;
}

function num(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1000000) throw new AppError('VALIDATION_ERROR', `${field} debe ser un número válido`);
  return n;
}

function textList(value, field) {
  if (!Array.isArray(value) || value.length > 15) throw new AppError('VALIDATION_ERROR', `${field} debe ser una lista de hasta 15 elementos`);
  return value.map(item => text(item, field, 300));
}

export function validateExplainBody(body) {
  const s = body?.solicitud;
  if (!s || typeof s !== 'object') throw new AppError('VALIDATION_ERROR', 'solicitud es obligatoria');
  const resultados = body?.resultados;
  if (!Array.isArray(resultados) || resultados.length < 1 || resultados.length > 30) throw new AppError('VALIDATION_ERROR', 'resultados debe tener entre 1 y 30 elementos');
  return {
    solicitud: {
      variedad: text(s.variedad, 'solicitud.variedad', 80),
      tipoArroz: text(s.tipoArroz, 'solicitud.tipoArroz', 80),
      volumenTn: num(s.volumenTn, 'solicitud.volumenTn'),
      quebradoMaxPct: num(s.quebradoMaxPct, 'solicitud.quebradoMaxPct'),
      humedadMaxPct: num(s.humedadMaxPct, 'solicitud.humedadMaxPct'),
      paisDestino: text(s.paisDestino, 'solicitud.paisDestino', 80),
      incoterm: text(s.incoterm, 'solicitud.incoterm', 10),
    },
    resultados: resultados.map(r => {
      if (!RESULTADOS.includes(r?.resultado)) throw new AppError('VALIDATION_ERROR', 'resultado inválido');
      return {
        loteId: text(r.loteId, 'loteId', 40),
        empresa: text(r.empresa, 'empresa', 120),
        resultado: r.resultado,
        coincidencias: textList(r.coincidencias, 'coincidencias'),
        diferencias: textList(r.diferencias, 'diferencias'),
        incumplimientos: textList(r.incumplimientos, 'incumplimientos'),
      };
    }),
  };
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('agent timeout')), timeoutMs); })]); } finally { clearTimeout(timer); }
}

// Sin Gemini (modo stub, sin clave, error o respuesta inválida) devuelve explanation null y el front usa su plantilla.
export async function explainOrFallback(input, deps = {}) {
  if ((process.env.AGENT_MODE || 'stub') !== 'gemini') return { explanation: null, agent: 'stub' };
  try {
    const explain = deps.explain ?? (await import('../agent/explainMatch.js')).explainMatch;
    const explanation = await withTimeout(explain(input), Number(process.env.AGENT_TIMEOUT_MS || 15000));
    return { explanation, agent: 'gemini' };
  } catch (error) {
    console.warn(`[matching] fallback a plantilla: ${error instanceof Error ? error.message : String(error)}`);
    return { explanation: null, agent: 'stub' };
  }
}

export function matchingRouter() {
  const router = Router();
  router.post('/explain', async (req, res, next) => { try { res.json(await explainOrFallback(validateExplainBody(req.body))); } catch (error) { next(error); } });
  return router;
}
