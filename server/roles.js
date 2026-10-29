export const USER_ROLES = [
  'super_admin',
  'manager',
  'customer',
  'stenotypist',
  'transcript_owner',
  'reconciliator',
  'accountant',
  'district_admin',
  'coordinator',
];

export const GLOBAL_USER_ROLES = [
  'stenotypist',
  'manager',
  'reconciliator',
  'accountant',
  'super_admin',
];

export const CUSTOMER_USER_ROLES = [
  'customer',
  'district_admin',
  'coordinator',
  'transcript_owner',
];

const ROLE_ALIASES = {
  superadmin: 'super_admin',
  'super admin': 'super_admin',
  admin: 'super_admin',
  steno: 'stenotypist',
  stenographer: 'stenotypist',
  owner: 'transcript_owner',
  'transcript owner': 'transcript_owner',
  'district admin': 'district_admin',
  reconciliator: 'reconciliator',
  accountant: 'accountant',
  coordinator: 'coordinator',
  customer: 'customer',
};

export function normalizeRole(role) {
  if (typeof role !== 'string') return 'stenotypist';
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (USER_ROLES.includes(normalized)) return normalized;
  return ROLE_ALIASES[normalized] ?? 'stenotypist';
}

export function normalizeRoles(userOrRoles) {
  if (Array.isArray(userOrRoles)) {
    return [...new Set(userOrRoles.map(normalizeRole))];
  }
  if (userOrRoles && typeof userOrRoles === 'object') {
    if (Array.isArray(userOrRoles.roles) && userOrRoles.roles.length > 0) {
      return [...new Set(userOrRoles.roles.map(normalizeRole))];
    }
    if (userOrRoles.role) {
      return [normalizeRole(userOrRoles.role)];
    }
  }
  return ['stenotypist'];
}

export function isUserRole(role) {
  return USER_ROLES.includes(normalizeRole(role));
}

export function getAllowedRolesForCustomer(customerId) {
  return customerId ? [...CUSTOMER_USER_ROLES] : [...GLOBAL_USER_ROLES];
}

export function validateRolesForCustomer(customerId, roles) {
  const allowed = new Set(getAllowedRolesForCustomer(customerId));
  return roles.every((role) => allowed.has(normalizeRole(role)));
}
