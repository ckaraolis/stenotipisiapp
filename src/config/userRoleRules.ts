import type { UserRole } from './roles';
import { MANAGER_ASSIGNABLE_ROLES } from './roles';

/** Roles allowed when no customer is assigned. */
export const GLOBAL_USER_ROLES: readonly UserRole[] = [
  'stenotypist',
  'manager',
  'reconciliator',
  'accountant',
  'super_admin',
];

/** Roles allowed when a customer is assigned. */
export const CUSTOMER_USER_ROLES: readonly UserRole[] = [
  'customer',
  'district_admin',
  'coordinator',
  'transcript_owner',
];

export function getAllowedRolesForCustomer(customerId: string | null): UserRole[] {
  return customerId ? [...CUSTOMER_USER_ROLES] : [...GLOBAL_USER_ROLES];
}

export function filterRolesByActor(actorRoles: readonly UserRole[], roles: UserRole[]): UserRole[] {
  if (actorRoles.includes('super_admin')) {
    return roles;
  }
  const allowed = new Set<UserRole>(MANAGER_ASSIGNABLE_ROLES);
  return roles.filter((role) => allowed.has(role));
}

export function getAssignableRoles(
  actorRoles: readonly UserRole[],
  customerId: string | null,
): UserRole[] {
  return filterRolesByActor(actorRoles, getAllowedRolesForCustomer(customerId));
}
