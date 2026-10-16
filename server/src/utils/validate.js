import { AppError } from './errors.js';

export function bodyObject(body) { if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('VALIDATION_ERROR', 'El cuerpo debe ser un objeto JSON'); return body; }
export function requiredString(value, field) { if (typeof value !== 'string' || !value.trim()) throw new AppError('VALIDATION_ERROR', `${field} es obligatorio`); return value.trim(); }
export function positiveNumber(value, field, max) { if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || (max !== undefined && value > max)) throw new AppError('VALIDATION_ERROR', `${field} debe ser mayor que cero${max ? ` y menor o igual que ${max}` : ''}`); return value; }
export function optionalPercent(value, field) { if (value === undefined) return 0; if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new AppError('VALIDATION_ERROR', `${field} debe estar entre 0 y 100`); return value; }
export function integerId(value, field) { const n = Number(value); if (!Number.isInteger(n) || n <= 0) throw new AppError('VALIDATION_ERROR', `${field} inválido`); return n; }
export function positiveInteger(value, field, max) { if (!Number.isInteger(value) || value < 1 || (max !== undefined && value > max)) throw new AppError('VALIDATION_ERROR', `${field} debe ser un entero entre 1 y ${max}`); return value; }
