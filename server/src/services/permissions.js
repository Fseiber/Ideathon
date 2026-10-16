export const USER_ROLES = ['ADMIN', 'COMEX', 'DOCS', 'FINANCE'];

const ROLE_PERMISSIONS = {
  ADMIN: ['*'],
  COMEX: ['companies:read', 'companies:write', 'lots:link', 'requests:*', 'reservations:*'],
  DOCS: ['companies:read', 'requests:read', 'reservations:read'],
  FINANCE: ['companies:read', 'requests:read', 'reservations:read'],
};

export function parseRoles(csv) { return String(csv || '').split(',').map(r => r.trim()).filter(Boolean); }

function grants(granted, perm) {
  if (granted === '*' || granted === perm) return true;
  return granted.endsWith(':*') && perm.startsWith(granted.slice(0, -1));
}

export function hasPermission(roles, perm) {
  return roles.some(role => (ROLE_PERMISSIONS[role] || []).some(granted => grants(granted, perm)));
}
