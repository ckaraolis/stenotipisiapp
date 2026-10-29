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
  { key: 'jobs', path: '/scheduling/jobs-steno', permission: 'scheduling.jobs' },
  { key: 'jobAllocation', path: '/scheduling/job-allocation', permission: 'scheduling.job_allocation' },
  { key: 'stenotypistLeave', path: '/scheduling/stenotypist-leave', permission: 'scheduling.stenotypist_leave' },
  { key: 'publicHolidays', path: '/scheduling/public-holidays', permission: 'scheduling.public_holidays' },
  { key: 'travellingTime', path: '/scheduling/travelling-time', permission: 'scheduling.travelling_time' },
  { key: 'schedulingReports', path: '/scheduling/reports', permission: 'scheduling.scheduling_reports' },
];

export const transcriptsNavItems: readonly NavItem[] = [
  { key: 'transcripts', path: '/transcripts/steno', permission: 'transcripts.transcripts' },
  {
    key: 'transcriptsAnalysisReport',
    path: '/transcripts/analysis-report',
    permission: 'transcripts.transcripts_analysis_report',
  },
];

export const projectsNavItems: readonly NavItem[] = [
  { key: 'customers', path: '/projects/customers', permission: 'projects.customers' },
  { key: 'projectsList', path: '/projects/list', permission: 'projects.projects' },
  { key: 'projectDistrict', path: '/projects/district', permission: 'projects.district' },
];

export const financialsNavItems: readonly NavItem[] = [
  {
    key: 'travellingCharges',
    path: '/financials/travelling-charges',
    permission: 'financials.travelling_charges',
  },
  { key: 'reconciliation', path: '/financials/reconciliation', permission: 'financials.reconciliation' },
  { key: 'proformas', path: '/financials/proformas', permission: 'financials.proformas' },
  {
    key: 'bonusConfiguration',
    path: '/financials/stenotypist-bonus',
    permission: 'financials.stenotypist_bonus',
  },
  {
    key: 'bonusesList',
    path: '/financials/stenotypist-bonuses',
    permission: 'financials.stenotypist_bonuses',
  },
  { key: 'penaltyConfiguration', path: '/financials/stenotypist-penalty', permission: 'financials.stenotypist_penalty' },
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
  {
    key: 'stenotypistFinancialsReport',
    path: '/financials/stenotypist-financials-report',
    permission: 'financials.stenotypist_financials_report',
  },
];

export const administrationNavItems: readonly NavItem[] = [
  { key: 'users', path: '/administration/users', permission: 'administration.users' },
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
  { key: 'financials' as const, path: '/financials/travelling-charges', children: financialsNavItems },
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
    if (pathname === '/transcripts/steno') {
      return 'transcripts';
    }
    const match = transcriptsNavItems.find((item) => item.path === pathname);
    return match?.key ?? 'transcripts';
  }

  if (pathname.startsWith('/projects/')) {
    const match = projectsNavItems.find((item) => item.path === pathname);
    return match?.key ?? 'projects';
  }

  if (pathname.startsWith('/financials/')) {
    const match = financialsNavItems.find((item) => item.path === pathname);
    return match?.key ?? 'financials';
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
  return pathname.startsWith('/financials');
}

export function isAdministrationPath(pathname: string): boolean {
  return pathname.startsWith('/administration');
}
