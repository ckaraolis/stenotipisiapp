import type { TranslationKey } from '../i18n/translations';

export const USER_ROLES = [
  'super_admin',
  'manager',
  'assistant_manager',
  'customer',
  'stenotypist',
  'stenographer',
  'transcript_owner',
  'reconciliator',
  'accountant',
  'district_admin',
  'coordinator',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

const ROLE_ALIASES: Record<string, UserRole> = {
  superadmin: 'super_admin',
  'super admin': 'super_admin',
  admin: 'super_admin',
  assistantmanager: 'assistant_manager',
  'assistant manager': 'assistant_manager',
  steno: 'stenotypist',
  stenographer: 'stenographer',
  owner: 'transcript_owner',
  'transcript owner': 'transcript_owner',
  'district admin': 'district_admin',
  customer: 'customer',
};

export const ROLE_LABEL_KEYS: Record<UserRole, TranslationKey> = {
  super_admin: 'roleSuperAdmin',
  manager: 'roleManager',
  assistant_manager: 'roleAssistantManager',
  customer: 'roleCustomer',
  stenotypist: 'roleStenotypist',
  stenographer: 'roleStenographer',
  transcript_owner: 'roleTranscriptOwner',
  reconciliator: 'roleReconciliator',
  accountant: 'roleAccountant',
  district_admin: 'roleDistrictAdmin',
  coordinator: 'roleCoordinator',
};

export const ROLE_DESCRIPTION_KEYS: Partial<Record<UserRole, TranslationKey>> = {
  super_admin: 'roleSuperAdminDescription',
  manager: 'roleManagerDescription',
  assistant_manager: 'roleAssistantManagerDescription',
  customer: 'roleCustomerDescription',
  stenotypist: 'roleStenotypistDescription',
  stenographer: 'roleStenographerDescription',
  transcript_owner: 'roleTranscriptOwnerDescription',
  reconciliator: 'roleReconciliatorDescription',
  accountant: 'roleAccountantDescription',
  district_admin: 'roleDistrictAdminDescription',
  coordinator: 'roleCoordinatorDescription',
};

/** Internal manager-equivalent roles. */
export const MANAGER_EQUIVALENT_ROLES: readonly UserRole[] = ['manager', 'assistant_manager'];

/** Roles treated as stenotypist workers for scheduling/financial assignment. */
export const STENOTYPIST_EQUIVALENT_ROLES: readonly UserRole[] = [
  'stenotypist',
  'stenographer',
];

/** Roles a Manager may assign when managing users (Super Admin is excluded). */
export const MANAGER_ASSIGNABLE_ROLES: readonly UserRole[] = [
  'manager',
  'assistant_manager',
  'customer',
  'stenotypist',
  'stenographer',
  'transcript_owner',
  'reconciliator',
  'accountant',
  'district_admin',
  'coordinator',
];

export function getRoleDescriptionKey(role: string | null | undefined): TranslationKey | null {
  return ROLE_DESCRIPTION_KEYS[normalizeRole(role)] ?? null;
}

export function normalizeRole(role: string | null | undefined): UserRole {
  if (!role) return 'stenotypist';
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if ((USER_ROLES as readonly string[]).includes(normalized)) {
    return normalized as UserRole;
  }
  return ROLE_ALIASES[normalized] ?? 'stenotypist';
}

export function normalizeRoles(
  value: string | readonly string[] | null | undefined,
): UserRole[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((role) => normalizeRole(role)))];
  }
  if (typeof value === 'string' && value) {
    return [normalizeRole(value)];
  }
  return ['stenotypist'];
}

export function isUserRole(role: string): role is UserRole {
  return (USER_ROLES as readonly string[]).includes(normalizeRole(role));
}

export function getRoleLabelKey(
  role: string | readonly string[] | null | undefined,
): TranslationKey {
  const roles = normalizeRoles(role);
  return ROLE_LABEL_KEYS[roles[0] ?? 'stenotypist'];
}

export function formatRoleLabels(
  roles: readonly string[],
  t: (key: TranslationKey) => string,
): string {
  return normalizeRoles(roles)
    .map((role) => t(getRoleLabelKey(role)))
    .join(', ');
}

export function isSuperAdminRole(roles: readonly string[]): boolean {
  return normalizeRoles(roles).includes('super_admin');
}

export function hasManagerEquivalentRole(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  return normalizeRoles(roleOrRoles).some((role) => MANAGER_EQUIVALENT_ROLES.includes(role));
}

export function hasStenotypistEquivalentRole(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  return normalizeRoles(roleOrRoles).some((role) =>
    STENOTYPIST_EQUIVALENT_ROLES.includes(role),
  );
}
