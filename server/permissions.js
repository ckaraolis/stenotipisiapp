import { normalizeRole, normalizeRoles } from './roles.js';

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
];

export const SUPER_ADMIN_PERMISSIONS = PERMISSIONS.filter(
  (permission) => permission !== 'dashboard.view',
);

export const MANAGER_PERMISSIONS = PERMISSIONS.filter(
  (permission) => permission !== 'administration.audit_trail' && permission !== 'dashboard.view',
);

export const STENOTYPIST_PERMISSIONS = [
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

export const TRANSCRIPT_OWNER_PERMISSIONS = [
  'transcripts.transcripts',
  'administration.account_management',
];

export const RECONCILIATOR_PERMISSIONS = [
  'financials.reconciliation',
  'administration.notifications',
];

export const ACCOUNTANT_PERMISSIONS = [
  'financials.proformas',
  'administration.notifications',
];

export const DISTRICT_ADMIN_PERMISSIONS = [
  'scheduling.jobs',
  'projects.projects',
  'projects.district',
  'administration.account_management',
  'administration.notifications',
];

export const COORDINATOR_PERMISSIONS = [
  'scheduling.jobs',
  'scheduling.job_allocation',
  'projects.projects',
  'administration.notifications',
];

export const CUSTOMER_MODULE_PERMISSIONS = ['projects.customers'];

/** §3.4 — Project module permissions (projects list and district). */
export const PROJECT_MODULE_PERMISSIONS = ['projects.projects', 'projects.district'];

export const CUSTOMER_PERMISSIONS = [
  ...CUSTOMER_MODULE_PERMISSIONS,
  'administration.account_management',
  'administration.notifications',
];

export const ROLE_PERMISSIONS = {
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

export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[normalizeRole(role)] ?? [];
}

export function getPermissionsForRoles(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return PERMISSIONS;
  }
  const granted = new Set();
  for (const role of roles) {
    for (const permission of getPermissionsForRole(role)) {
      granted.add(permission);
    }
  }
  return [...granted];
}

export function roleHasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

export function hasPermission(userOrRoles, permission) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => roleHasPermission(role, permission));
}

/** §2.6 — Customer module is available to Customer and Manager roles (Super Admin bypass). */
export const CUSTOMER_MODULE_ROLES = ['customer', 'manager'];

export function canAccessCustomerModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => CUSTOMER_MODULE_ROLES.includes(role));
}

/** §3.4 — Project module is available to Manager, Stenotypist, Coordinator, and District Admin. */
export const PROJECT_MODULE_ROLES = [
  'manager',
  'stenotypist',
  'coordinator',
  'district_admin',
];

export function canAccessProjectModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => PROJECT_MODULE_ROLES.includes(role));
}

/** §1.5 — Travelling charges configuration is available to Manager only (Super Admin bypass). */
export const TRAVELLING_CHARGES_MODULE_ROLES = ['manager'];

export function canAccessTravellingChargesModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => TRAVELLING_CHARGES_MODULE_ROLES.includes(role));
}

/** §2.4 — Job reconciliation is available to Manager and Reconciliator (Super Admin bypass). */
export const JOB_RECONCILIATION_MODULE_ROLES = ['manager', 'reconciliator'];

export function canAccessJobReconciliationModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => JOB_RECONCILIATION_MODULE_ROLES.includes(role));
}

/** §3.8 — Customer invoicing is available to Manager and Accountant (Super Admin bypass). */
export const CUSTOMER_INVOICING_MODULE_ROLES = ['manager', 'accountant'];

export const CUSTOMER_INVOICING_MODULE_PERMISSIONS = ['financials.proformas'];

export function canAccessCustomerInvoicingModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => CUSTOMER_INVOICING_MODULE_ROLES.includes(role));
}

/** §1.4 — Public holidays are available to Manager only (Super Admin bypass). */
export const PUBLIC_HOLIDAY_MODULE_ROLES = ['manager'];

export function canAccessPublicHolidayModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => PUBLIC_HOLIDAY_MODULE_ROLES.includes(role));
}

/** §2.4.1 — Stenotypist leave is available to Stenotypist and Manager (Super Admin bypass). */
export const STENOTYPIST_LEAVE_MODULE_ROLES = ['stenotypist', 'manager'];

export function canAccessStenotypistLeaveModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => STENOTYPIST_LEAVE_MODULE_ROLES.includes(role));
}

export function canManageStenotypistLeaveForOthers(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.includes('manager');
}

export function isStenotypistLeaveSelfServiceOnly(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin') || roles.includes('manager')) {
    return false;
  }
  return roles.includes('stenotypist');
}

/** §4.6 — Bonus configuration is available to Manager only (Super Admin bypass). */
export const BONUS_CONFIGURATION_MODULE_ROLES = ['manager'];

export function canAccessBonusConfigurationModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => BONUS_CONFIGURATION_MODULE_ROLES.includes(role));
}

/** §4.6 — Bonuses list is available to Manager and Stenotypist (Super Admin bypass). */
export const STENOTYPIST_BONUSES_MODULE_ROLES = ['manager', 'stenotypist'];

export function canAccessStenotypistBonusesModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => STENOTYPIST_BONUSES_MODULE_ROLES.includes(role));
}

/** §5.6 — Penalty configuration is available to Manager only (Super Admin bypass). */
export const PENALTY_CONFIGURATION_MODULE_ROLES = ['manager'];

export function canAccessPenaltyConfigurationModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => PENALTY_CONFIGURATION_MODULE_ROLES.includes(role));
}

/** §5.6 — Penalties list is available to Manager and Stenotypist (Super Admin bypass). */
export const STENOTYPIST_PENALTIES_MODULE_ROLES = ['manager', 'stenotypist'];

export function canAccessStenotypistPenaltiesModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => STENOTYPIST_PENALTIES_MODULE_ROLES.includes(role));
}

/** §6.7 — Travel expense configuration is available to Manager only (Super Admin bypass). */
export const TRAVEL_EXPENSE_CONFIGURATION_MODULE_ROLES = ['manager'];

export function canAccessTravelExpenseConfigurationModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => TRAVEL_EXPENSE_CONFIGURATION_MODULE_ROLES.includes(role));
}

/** §6.7 — Travel expense list is available to Manager and Stenotypist (Super Admin bypass). */
export const TRAVEL_EXPENSE_LIST_MODULE_ROLES = ['manager', 'stenotypist'];

export function canAccessTravelExpenseListModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => TRAVEL_EXPENSE_LIST_MODULE_ROLES.includes(role));
}

export function isStenotypistTravelExpenseSelfServiceOnly(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin') || roles.includes('manager')) {
    return false;
  }
  return roles.includes('stenotypist');
}

/** §7.2 — Stenotypist Financials Report is available to Manager and Stenotypist (Super Admin bypass). */
export const STENOTYPIST_FINANCIALS_REPORT_MODULE_ROLES = ['manager', 'stenotypist'];

export function canAccessStenotypistFinancialsReportModule(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin')) {
    return true;
  }
  return roles.some((role) => STENOTYPIST_FINANCIALS_REPORT_MODULE_ROLES.includes(role));
}

export function isStenotypistFinancialsReportSelfServiceOnly(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes('super_admin') || roles.includes('manager')) {
    return false;
  }
  return roles.includes('stenotypist');
}
