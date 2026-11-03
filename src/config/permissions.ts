import type { UserRole } from './roles';
import { isSuperAdminRole, normalizeRole, normalizeRoles } from './roles';
import { canAccessJobListModule } from './jobListPermissions';
export const PERMISSIONS = [
  'dashboard.view',
  'scheduling.jobs',
  'scheduling.job_allocation',
  'scheduling.stenotypist_leave',
  'scheduling.public_holidays',
  'scheduling.travelling_time',
  'scheduling.scheduling_reports',
  'transcripts.transcripts',
  'transcripts.transcripts_analysis_report',
  'projects.customers',
  'projects.projects',
  'projects.district',
  'financials.travelling_charges',
  'financials.reconciliation',
  'financials.proformas',
  'financials.stenotypist_bonus',
  'financials.stenotypist_bonuses',
  'financials.stenotypist_penalty',
  'financials.stenotypist_penalties',
  'financials.travel_expenses',
  'financials.travel_expense_list',
  'financials.stenotypist_financials_report',
  'administration.users',
  'administration.audit_trail',
  'administration.account_management',
  'administration.notifications',
  'administration.stenotypist_assets',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const MANAGER_PERMISSIONS: readonly Permission[] = [
  'scheduling.jobs',
  'scheduling.job_allocation',
  'scheduling.stenotypist_leave',
  'scheduling.public_holidays',
  'scheduling.travelling_time',
  'scheduling.scheduling_reports',
  'transcripts.transcripts',
  'transcripts.transcripts_analysis_report',
  'projects.customers',
  'projects.projects',
  'projects.district',
  'financials.travelling_charges',
  'financials.reconciliation',
  'financials.proformas',
  'financials.stenotypist_bonus',
  'financials.stenotypist_bonuses',
  'financials.stenotypist_penalty',
  'financials.stenotypist_penalties',
  'financials.travel_expenses',
  'financials.travel_expense_list',
  'financials.stenotypist_financials_report',
  'administration.users',
  'administration.account_management',
  'administration.notifications',
  'administration.stenotypist_assets',
];

export const SUPER_ADMIN_PERMISSIONS: readonly Permission[] = [...PERMISSIONS];

export function isSuperAdmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'super_admin';
}

export const STENOTYPIST_PERMISSIONS: readonly Permission[] = [
  'dashboard.view',
  'scheduling.jobs',
  'scheduling.stenotypist_leave',
  'transcripts.transcripts',
  'projects.projects',
  'financials.stenotypist_bonuses',
  'financials.stenotypist_penalties',
  'financials.travel_expense_list',
  'financials.stenotypist_financials_report',
  'administration.account_management',
  'administration.notifications',
];

export const TRANSCRIPT_OWNER_PERMISSIONS: readonly Permission[] = [
  'transcripts.transcripts',
  'administration.account_management',
];

export const RECONCILIATOR_PERMISSIONS: readonly Permission[] = [
  'financials.reconciliation',
  'administration.notifications',
];

export const ACCOUNTANT_PERMISSIONS: readonly Permission[] = [
  'financials.proformas',
  'administration.notifications',
];

export const DISTRICT_ADMIN_PERMISSIONS: readonly Permission[] = [
  'scheduling.jobs',
  'projects.projects',
  'projects.district',
  'administration.account_management',
  'administration.notifications',
];

export const COORDINATOR_PERMISSIONS: readonly Permission[] = [
  'scheduling.jobs',
  'scheduling.job_allocation',
  'projects.projects',
  'administration.notifications',
];

/** Customer module access per §2.6 — only Customer and Manager roles. */
export const CUSTOMER_MODULE_PERMISSIONS: readonly Permission[] = ['projects.customers'];

/** §3.4 — Project module permissions (projects list and district). */
export const PROJECT_MODULE_PERMISSIONS: readonly Permission[] = [
  'projects.projects',
  'projects.district',
];

export const CUSTOMER_PERMISSIONS: readonly Permission[] = [
  ...CUSTOMER_MODULE_PERMISSIONS,
  'administration.account_management',
  'administration.notifications',
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  super_admin: SUPER_ADMIN_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  customer: CUSTOMER_PERMISSIONS,
  stenotypist: STENOTYPIST_PERMISSIONS,
  transcript_owner: TRANSCRIPT_OWNER_PERMISSIONS,
  reconciliator: RECONCILIATOR_PERMISSIONS,
  accountant: ACCOUNTANT_PERMISSIONS,
  district_admin: DISTRICT_ADMIN_PERMISSIONS,
  coordinator: COORDINATOR_PERMISSIONS,
};

export function getPermissionsForRoles(
  roles: string | readonly string[] | null | undefined,
): readonly Permission[] {
  const normalized = normalizeRoles(roles);
  if (isSuperAdminRole(normalized)) {
    return PERMISSIONS;
  }
  const granted = new Set<Permission>();
  for (const role of normalized) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      granted.add(permission);
    }
  }
  return [...granted];
}

export function getPermissionsForRole(role: string | null | undefined): readonly Permission[] {
  return getPermissionsForRoles(role);
}

export function hasPermission(
  roleOrRoles: string | readonly string[] | null | undefined,
  permission: Permission,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return getPermissionsForRoles(roleOrRoles).includes(permission);
}

export function hasAnyPermission(
  roleOrRoles: string | readonly string[] | null | undefined,
  permissions: readonly Permission[],
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  const granted = getPermissionsForRoles(roleOrRoles);
  return permissions.some((permission) => granted.includes(permission));
}

/** §2.6 — Customer module is available to Customer and Manager roles (Super Admin bypass). */
export const CUSTOMER_MODULE_ROLES: readonly UserRole[] = ['customer', 'manager'];

export function canAccessCustomerModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) => CUSTOMER_MODULE_ROLES.includes(role));
}

/** §3.4 — Project module is available to Manager, Stenotypist, Coordinator, and District Admin. */
export const PROJECT_MODULE_ROLES: readonly UserRole[] = [
  'manager',
  'stenotypist',
  'coordinator',
  'district_admin',
];

export function canAccessProjectModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) => PROJECT_MODULE_ROLES.includes(role));
}

export function getDefaultProjectsPath(
  roleOrRoles: string | readonly string[] | null | undefined,
): string {
  const paths = ['/projects/list', '/projects/district', '/projects/customers'] as const;
  for (const path of paths) {
    if (canAccessPath(roleOrRoles, path)) {
      return path;
    }
  }
  return '/profile';
}

/** §1.5 — Travelling charges configuration is available to Manager only (Super Admin bypass). */
export const TRAVELLING_CHARGES_MODULE_ROLES: readonly UserRole[] = ['manager'];

export function canAccessTravellingChargesModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) =>
    TRAVELLING_CHARGES_MODULE_ROLES.includes(role),
  );
}

/** §2.4 — Job reconciliation is available to Manager and Reconciliator (Super Admin bypass). */
export const JOB_RECONCILIATION_MODULE_ROLES: readonly UserRole[] = ['manager', 'reconciliator'];

export function canAccessJobReconciliationModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) =>
    JOB_RECONCILIATION_MODULE_ROLES.includes(role),
  );
}

/** §3.8 — Customer invoicing is available to Manager and Accountant (Super Admin bypass). */
export const CUSTOMER_INVOICING_MODULE_ROLES: readonly UserRole[] = ['manager', 'accountant'];

export const CUSTOMER_INVOICING_MODULE_PERMISSIONS: readonly Permission[] = ['financials.proformas'];

export function canAccessCustomerInvoicingModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) =>
    CUSTOMER_INVOICING_MODULE_ROLES.includes(role),
  );
}

/** §1.4 — Public holidays are available to Manager only (Super Admin bypass). */
export const PUBLIC_HOLIDAY_MODULE_ROLES: readonly UserRole[] = ['manager'];

export function canAccessPublicHolidayModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) => PUBLIC_HOLIDAY_MODULE_ROLES.includes(role));
}

/** §2.4.1 — Stenotypist leave is available to Stenotypist and Manager (Super Admin bypass). */
export const STENOTYPIST_LEAVE_MODULE_ROLES: readonly UserRole[] = ['stenotypist', 'manager'];

export function canAccessStenotypistLeaveModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) =>
    STENOTYPIST_LEAVE_MODULE_ROLES.includes(role),
  );
}

export function canManageStenotypistLeaveForOthers(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).includes('manager');
}

export function isStenotypistLeaveSelfServiceOnly(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  if (isSuperAdminRole(roles) || roles.includes('manager')) {
    return false;
  }
  return roles.includes('stenotypist');
}

/** §4.6 — Bonus configuration is available to Manager only (Super Admin bypass). */
export const BONUS_CONFIGURATION_MODULE_ROLES: readonly UserRole[] = ['manager'];

export function canAccessBonusConfigurationModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) =>
    BONUS_CONFIGURATION_MODULE_ROLES.includes(role),
  );
}

/** §4.6 — Bonuses list is available to Manager and Stenotypist (Super Admin bypass). */
export const STENOTYPIST_BONUSES_MODULE_ROLES: readonly UserRole[] = ['manager', 'stenotypist'];

export function canAccessStenotypistBonusesModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) =>
    STENOTYPIST_BONUSES_MODULE_ROLES.includes(role),
  );
}

export function isStenotypistBonusesSelfServiceOnly(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  if (isSuperAdminRole(roles) || roles.includes('manager')) {
    return false;
  }
  return roles.includes('stenotypist');
}

/** §5.6 — Penalty configuration is available to Manager only (Super Admin bypass). */
export const PENALTY_CONFIGURATION_MODULE_ROLES: readonly UserRole[] = ['manager'];

export function canAccessPenaltyConfigurationModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) =>
    PENALTY_CONFIGURATION_MODULE_ROLES.includes(role),
  );
}

/** §5.6 — Penalties list is available to Manager and Stenotypist (Super Admin bypass). */
export const STENOTYPIST_PENALTIES_MODULE_ROLES: readonly UserRole[] = ['manager', 'stenotypist'];

export function canAccessStenotypistPenaltiesModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) =>
    STENOTYPIST_PENALTIES_MODULE_ROLES.includes(role),
  );
}

export function isStenotypistPenaltiesSelfServiceOnly(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  if (isSuperAdminRole(roles) || roles.includes('manager')) {
    return false;
  }
  return roles.includes('stenotypist');
}

/** §6.7 — Travel expense configuration is available to Manager only (Super Admin bypass). */
export const TRAVEL_EXPENSE_CONFIGURATION_MODULE_ROLES: readonly UserRole[] = ['manager'];

export function canAccessTravelExpenseConfigurationModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) =>
    TRAVEL_EXPENSE_CONFIGURATION_MODULE_ROLES.includes(role),
  );
}

/** §6.7 — Travel expense list is available to Manager and Stenotypist (Super Admin bypass). */
export const TRAVEL_EXPENSE_LIST_MODULE_ROLES: readonly UserRole[] = ['manager', 'stenotypist'];

export function canAccessTravelExpenseListModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) =>
    TRAVEL_EXPENSE_LIST_MODULE_ROLES.includes(role),
  );
}

export function isStenotypistTravelExpenseSelfServiceOnly(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  if (isSuperAdminRole(roles) || roles.includes('manager')) {
    return false;
  }
  return roles.includes('stenotypist');
}

/** §7.2 — Stenotypist Financials Report is available to Manager and Stenotypist (Super Admin bypass). */
export const STENOTYPIST_FINANCIALS_REPORT_MODULE_ROLES: readonly UserRole[] = [
  'manager',
  'stenotypist',
];

export function canAccessStenotypistFinancialsReportModule(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }
  return normalizeRoles(roleOrRoles).some((role) =>
    STENOTYPIST_FINANCIALS_REPORT_MODULE_ROLES.includes(role),
  );
}

export function isStenotypistFinancialsReportSelfServiceOnly(
  roleOrRoles: string | readonly string[] | null | undefined,
): boolean {
  const roles = normalizeRoles(roleOrRoles);
  if (isSuperAdminRole(roles) || roles.includes('manager')) {
    return false;
  }
  return roles.includes('stenotypist');
}

export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/dashboard': 'dashboard.view',
  '/scheduling/jobs-steno': 'scheduling.jobs',
  '/scheduling/job-allocation': 'scheduling.job_allocation',
  '/scheduling/stenotypist-leave': 'scheduling.stenotypist_leave',
  '/scheduling/public-holidays': 'scheduling.public_holidays',
  '/scheduling/travelling-time': 'scheduling.travelling_time',
  '/scheduling/reports': 'scheduling.scheduling_reports',
  '/transcripts/steno': 'transcripts.transcripts',
  '/transcripts/analysis-report': 'transcripts.transcripts_analysis_report',
  '/projects/customers': 'projects.customers',
  '/projects/list': 'projects.projects',
  '/projects/district': 'projects.district',
  '/financials/travelling-charges': 'financials.travelling_charges',
  '/financials/reconciliation': 'financials.reconciliation',
  '/financials/proformas': 'financials.proformas',
  '/financials/stenotypist-bonus': 'financials.stenotypist_bonus',
  '/financials/stenotypist-bonuses': 'financials.stenotypist_bonuses',
  '/financials/stenotypist-penalty': 'financials.stenotypist_penalty',
  '/financials/stenotypist-penalties': 'financials.stenotypist_penalties',
  '/financials/travel-expenses': 'financials.travel_expenses',
  '/financials/travel-expense-list': 'financials.travel_expense_list',
  '/financials/stenotypist-financials-report': 'financials.stenotypist_financials_report',
  '/administration/users': 'administration.users',
  '/administration/audit-trail': 'administration.audit_trail',
  '/administration/account-management': 'administration.account_management',
  '/administration/notifications': 'administration.notifications',
  '/administration/stenotypist-assets': 'administration.stenotypist_assets',
};

const DEFAULT_PATH_ORDER = [
  '/dashboard',
  '/scheduling/jobs-steno',
  '/scheduling/job-allocation',
  '/scheduling/stenotypist-leave',
  '/scheduling/public-holidays',
  '/scheduling/travelling-time',
  '/scheduling/reports',
  '/transcripts/steno',
  '/transcripts/analysis-report',
  '/projects/customers',
  '/projects/list',
  '/projects/district',
  '/financials/travelling-charges',
  '/financials/reconciliation',
  '/financials/proformas',
  '/financials/stenotypist-bonus',
  '/financials/stenotypist-bonuses',
  '/financials/stenotypist-penalty',
  '/financials/stenotypist-penalties',
  '/financials/travel-expenses',
  '/financials/travel-expense-list',
  '/financials/stenotypist-financials-report',
  '/administration/users',
  '/administration/audit-trail',
  '/administration/account-management',
  '/administration/notifications',
  '/administration/stenotypist-assets',
] as const;

export function canAccessPath(
  roleOrRoles: string | readonly string[] | null | undefined,
  pathname: string,
): boolean {
  if (pathname === '/profile' || pathname === '/about') {
    return true;
  }

  if (isSuperAdminRole(normalizeRoles(roleOrRoles))) {
    return true;
  }

  if (pathname === '/scheduling/stenotypist-leave') {
    return canAccessStenotypistLeaveModule(roleOrRoles);
  }

  if (pathname === '/financials/travelling-charges') {
    return canAccessTravellingChargesModule(roleOrRoles);
  }

  if (pathname === '/financials/reconciliation') {
    return canAccessJobReconciliationModule(roleOrRoles);
  }

  if (pathname === '/financials/proformas') {
    return canAccessCustomerInvoicingModule(roleOrRoles);
  }

  if (pathname === '/financials/stenotypist-bonus') {
    return canAccessBonusConfigurationModule(roleOrRoles);
  }

  if (pathname === '/financials/stenotypist-bonuses') {
    return canAccessStenotypistBonusesModule(roleOrRoles);
  }

  if (pathname === '/financials/stenotypist-penalty') {
    return canAccessPenaltyConfigurationModule(roleOrRoles);
  }

  if (pathname === '/financials/stenotypist-penalties') {
    return canAccessStenotypistPenaltiesModule(roleOrRoles);
  }

  if (pathname === '/financials/travel-expenses') {
    return canAccessTravelExpenseConfigurationModule(roleOrRoles);
  }

  if (pathname === '/financials/travel-expense-list') {
    return canAccessTravelExpenseListModule(roleOrRoles);
  }

  if (pathname === '/financials/stenotypist-financials-report') {
    return canAccessStenotypistFinancialsReportModule(roleOrRoles);
  }

  const permission = ROUTE_PERMISSIONS[pathname];
  if (!permission) {
    return true;
  }

  if (pathname.startsWith('/scheduling/jobs')) {
    return hasPermission(roleOrRoles, permission) && canAccessJobListModule(roleOrRoles);
  }

  return hasPermission(roleOrRoles, permission);
}

export function getDefaultPath(roleOrRoles: string | readonly string[] | null | undefined): string {
  const roles = normalizeRoles(roleOrRoles);
  const order =
    isSuperAdminRole(roles)
      ? DEFAULT_PATH_ORDER.filter((path) => path !== '/dashboard')
      : DEFAULT_PATH_ORDER;

  for (const path of order) {
    const permission = ROUTE_PERMISSIONS[path];
    if (hasPermission(roles, permission)) {
      return path;
    }
  }
  return '/profile';
}
