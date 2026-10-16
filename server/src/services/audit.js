export function audit(db, userId, action, entity, entityId, data) {
  return db.auditEvent.create({ data: { userId, action, entity, entityId: String(entityId), data: data === undefined ? null : JSON.stringify(data) } });
}
