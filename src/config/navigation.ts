import type { Permission } from './permissions';
import type { TranslationKey } from '../i18n/translations';

export interface NavItem {
  key: TranslationKey;
  path: string;
  permission: Permission;
}

export const dashboardNavItem: NavItem = {
  key: 'dashboard',
  path: '/dashboard',
  permission: 'dashboard.view',
};

export const schedulingNavItems: readonly NavItem[] = [
  { key: 'jobsSteno', path: '/scheduling/jobs-steno', permission: 'scheduling.jobs' },
  { key: 'jobAllocation', path: '/scheduling/job-allocation', permission: 'scheduling.job_allocation' },
];

export const transcriptsNavItems: readonly NavItem[] = [
  { key: 'transcriptsSteno', path: '/transcripts/steno', permission: 'transcripts.transcripts' },
];

export const projectsNavItems: readonly NavItem[] = [
  { key: 'customers', path: '/projects/customers', permission: 'projects.customers' },
  { key: 'projectsList', path: '/projects/list', permission: 'projects.projects' },
  { key: 'projectTypes', path: '/projects/types', permission: 'projects.project_types' },
  {
    key: 'customerFieldsToUsers',
    path: '/projects/customer-fields',
    permission: 'projects.customer_fields',
  },
];

/** Financials module: rates and bonus/penalty configuration only. */
export const financialsNavItems: readonly NavItem[] = [
  {
    key: 'stenoRates',
    path: '/financials/steno-rates',
    permission: 'financials.steno_rates',
  },
  {
    key: 'bonusConfiguration',
    path: '/financials/stenotypist-bonus',
    permission: 'financials.stenotypist_bonus',
  },
  {
    key: 'penaltyConfiguration',
    path: '/financials/stenotypist-penalty',
    permission: 'financials.stenotypist_penalty',
  },
];

/** Invoicing module: charges, proformas, and expense/bonus lists. */
export const invoicingNavItems: readonly NavItem[] = [
  {
    key: 'travellingCharges',
    path: '/financials/travelling-charges',
    permission: 'financials.travelling_charges',
  },
  { key: 'reconciliation', path: '/financials/reconciliation', permission: 'financials.reconciliation' },
  { key: 'proformas', path: '/financials/proformas', permission: 'financials.proformas' },
  {
    key: 'bonusesList',
    path: '/financials/stenotypist-bonuses',
    permission: 'financials.stenotypist_bonuses',
  },
  {
    key: 'penaltiesList',
    path: '/financials/stenotypist-penalties',
    permission: 'financials.stenotypist_penalties',
  },
  { key: 'travExpConfiguration', path: '/financials/travel-expenses', permission: 'financials.travel_expenses' },
  {
    key: 'travelExpenseList',
    path: '/financials/travel-expense-list',
    permission: 'financials.travel_expense_list',
  },
];

/** Reports module: financial (and related) reports. */
export const reportsNavItems: readonly NavItem[] = [
  {
    key: 'stenotypistFinancialsReport',
    path: '/financials/stenotypist-financials-report',
    permission: 'financials.stenotypist_financials_report',
  },
];

export const administrationNavItems: readonly NavItem[] = [
  { key: 'users', path: '/administration/users', permission: 'administration.users' },
  { key: 'projectDistrict', path: '/administration/districts', permission: 'projects.district' },
  { key: 'auditTrail', path: '/administration/audit-trail', permission: 'administration.audit_trail' },
  {
    key: 'accountManagement',
    path: '/administration/account-management',
    permission: 'administration.account_management',
  },
  { key: 'notifications', path: '/administration/notifications', permission: 'administration.notifications' },
  {
    key: 'stenotypistAssets',
    path: '/administration/stenotypist-assets',
    permission: 'administration.stenotypist_assets',
  },
];

export const mainNavGroups = [
  { key: 'scheduling' as const, path: '/scheduling/jobs-steno', children: schedulingNavItems },
  { key: 'transcripts' as const, path: '/transcripts/steno', children: transcriptsNavItems },
  { key: 'projects' as const, path: '/projects/list', children: projectsNavItems },
  { key: 'financials' as const, path: '/financials/steno-rates', children: financialsNavItems },
  { key: 'invoicing' as const, path: '/financials/travelling-charges', children: invoicingNavItems },
  {
    key: 'reports' as const,
    path: '/financials/stenotypist-financials-report',
    children: reportsNavItems,
  },
  { key: 'administration' as const, path: '/administration/users', children: administrationNavItems },
];

export const secondaryNavItems = [
  { key: 'myProfile' as const, path: '/profile' },
  { key: 'aboutApp' as const, path: '/about' },
] as const;

export type MainNavGroupKey = (typeof mainNavGroups)[number]['key'];
export type SecondaryNavKey = (typeof secondaryNavItems)[number]['key'];
export type NavKey = MainNavGroupKey | SecondaryNavKey | NavItem['key'];

const flatRoutes: Record<string, string> = {
  dashboard: '/dashboard',
  myProfile: '/profile',
  aboutApp: '/about',
};

for (const group of mainNavGroups) {
  flatRoutes[group.key] = group.path;
  for (const item of group.children) {
    flatRoutes[item.key] = item.path;
  }
}

for (const item of secondaryNavItems) {
  flatRoutes[item.key] = item.path;
}

export function getPathLabelKey(pathname: string): NavKey | null {
  if (pathname === '/dashboard') {
    return 'dashboard';
  }

  if (pathname.startsWith('/scheduling/')) {
    const match = schedulingNavItems.find((item) => item.path === pathname);
    return match?.key ?? 'scheduling';
  }

  if (pathname.startsWith('/transcripts/')) {
    const match = transcriptsNavItems.find((item) => item.path === pathname);
    return match?.key ?? 'transcripts';
  }

  if (pathname.startsWith('/projects/')) {
    const match = projectsNavItems.find((item) => item.path === pathname);
    return match?.key ?? 'projects';
  }

  if (pathname.startsWith('/financials/')) {
    const financialMatch = financialsNavItems.find((item) => item.path === pathname);
    if (financialMatch) return financialMatch.key;
    const invoicingMatch = invoicingNavItems.find((item) => item.path === pathname);
    if (invoicingMatch) return invoicingMatch.key;
    const reportsMatch = reportsNavItems.find((item) => item.path === pathname);
    if (reportsMatch) return reportsMatch.key;
    return 'financials';
  }

  if (pathname.startsWith('/administration/')) {
    const match = administrationNavItems.find((item) => item.path === pathname);
    return match?.key ?? 'administration';
  }

  const entry = Object.entries(flatRoutes).find(([, path]) => path === pathname);
  return entry ? (entry[0] as NavKey) : null;
}

export function isSchedulingPath(pathname: string): boolean {
  return pathname.startsWith('/scheduling');
}

export function isTranscriptsPath(pathname: string): boolean {
  return pathname.startsWith('/transcripts');
}

export function isProjectsPath(pathname: string): boolean {
  return pathname.startsWith('/projects');
}

export function isFinancialsPath(pathname: string): boolean {
  return financialsNavItems.some((item) => item.path === pathname);
}

export function isInvoicingPath(pathname: string): boolean {
  return invoicingNavItems.some((item) => item.path === pathname);
}

export function isReportsPath(pathname: string): boolean {
  return reportsNavItems.some((item) => item.path === pathname);
}

export function isAdministrationPath(pathname: string): boolean {
  return pathname.startsWith('/administration');
}
