export class AppError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

export function errorResponse(error, res) {
  const known = error instanceof AppError;
  const status = known ? error.status : 500;
  if (!known) console.error(error);
  return res.status(status).json({ error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'Error interno' } });
}
