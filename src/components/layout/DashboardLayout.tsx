import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  mainNavGroups,
  secondaryNavItems,
  dashboardNavItem,
  getPathLabelKey,
  isSchedulingPath,
  isTranscriptsPath,
  isProjectsPath,
  isFinancialsPath,
  isAdministrationPath,
  type NavItem,
} from '../../config/navigation';
import { hasPermission, getDefaultProjectsPath, canAccessTravellingChargesModule, canAccessJobReconciliationModule, canAccessCustomerInvoicingModule, canAccessBonusConfigurationModule, canAccessStenotypistBonusesModule, canAccessPenaltyConfigurationModule, canAccessStenotypistPenaltiesModule, canAccessTravelExpenseConfigurationModule, canAccessTravelExpenseListModule, canAccessStenotypistFinancialsReportModule } from '../../config/permissions';
import { useLanguage } from '../../i18n/LanguageContext';
import { getAuthUser, signOut } from '../../utils/auth';
import { getRoleLabelKey } from '../../config/roles';
import '../../styles/dashboard.css';

const SIDEBAR_COLLAPSED_KEY = 'stenotipisi-sidebar-collapsed';

type NavGroupKey = (typeof mainNavGroups)[number]['key'];

const groupPathChecks: Record<NavGroupKey, (pathname: string) => boolean> = {
  scheduling: isSchedulingPath,
  transcripts: isTranscriptsPath,
  projects: isProjectsPath,
  financials: isFinancialsPath,
  administration: isAdministrationPath,
};

function getInitialSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

function filterNavItems(
  items: readonly NavItem[],
  roleOrRoles: string | readonly string[] | undefined,
) {
  return items.filter((item) => {
    if (item.path === '/financials/travelling-charges') {
      return canAccessTravellingChargesModule(roleOrRoles);
    }
    if (item.path === '/financials/reconciliation') {
      return canAccessJobReconciliationModule(roleOrRoles);
    }
    if (item.path === '/financials/proformas') {
      return canAccessCustomerInvoicingModule(roleOrRoles);
    }
    if (item.path === '/financials/stenotypist-bonus') {
      return canAccessBonusConfigurationModule(roleOrRoles);
    }
    if (item.path === '/financials/stenotypist-bonuses') {
      return canAccessStenotypistBonusesModule(roleOrRoles);
    }
    if (item.path === '/financials/stenotypist-penalty') {
      return canAccessPenaltyConfigurationModule(roleOrRoles);
    }
    if (item.path === '/financials/stenotypist-penalties') {
      return canAccessStenotypistPenaltiesModule(roleOrRoles);
    }
    if (item.path === '/financials/travel-expenses') {
      return canAccessTravelExpenseConfigurationModule(roleOrRoles);
    }
    if (item.path === '/financials/travel-expense-list') {
      return canAccessTravelExpenseListModule(roleOrRoles);
    }
    if (item.path === '/financials/stenotypist-financials-report') {
      return canAccessStenotypistFinancialsReportModule(roleOrRoles);
    }
    return hasPermission(roleOrRoles, item.permission);
  });
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const [openGroups, setOpenGroups] = useState<Record<NavGroupKey, boolean>>({
    scheduling: isSchedulingPath(location.pathname),
    transcripts: isTranscriptsPath(location.pathname),
    projects: isProjectsPath(location.pathname),
    financials: isFinancialsPath(location.pathname),
    administration: isAdministrationPath(location.pathname),
  });
  const user = getAuthUser();
  const labelKey = getPathLabelKey(location.pathname);
  const roleLabelKey = getRoleLabelKey(user?.roles ?? user?.role);
  const initials = (user?.username ?? 'XK').slice(0, 2).toUpperCase();

  useEffect(() => {
    setOpenGroups((current) => ({
      ...current,
      scheduling: current.scheduling || isSchedulingPath(location.pathname),
      transcripts: current.transcripts || isTranscriptsPath(location.pathname),
      projects: current.projects || isProjectsPath(location.pathname),
      financials: current.financials || isFinancialsPath(location.pathname),
      administration: current.administration || isAdministrationPath(location.pathname),
    }));
  }, [location.pathname]);

  const breadcrumb =
    location.pathname === '/dashboard'
      ? t('dashboard')
      : isSchedulingPath(location.pathname)
    ? `${t('scheduling')} / ${t(labelKey ?? 'scheduling')}`
    : isTranscriptsPath(location.pathname)
      ? `${t('transcripts')} / ${t(labelKey ?? 'transcripts')}`
      : isProjectsPath(location.pathname)
        ? `${t('projects')} / ${t(labelKey ?? 'projects')}`
        : isFinancialsPath(location.pathname)
          ? `${t('financials')} / ${t(labelKey ?? 'financials')}`
          : isAdministrationPath(location.pathname)
            ? `${t('administration')} / ${t(labelKey ?? 'administration')}`
            : labelKey
              ? t(labelKey)
              : t('appName');

  const handleLogout = () => {
    void signOut().then(() => {
      navigate('/signin');
    });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const visibleGroups = mainNavGroups
    .map((group) => ({
      ...group,
      children: filterNavItems(group.children, user?.roles ?? user?.role),
    }))
    .filter((group) => group.children.length > 0);

  const showDashboard = hasPermission(user?.roles ?? user?.role, dashboardNavItem.permission);

  return (
    <div className="dashboard">
      <aside className={`sidebar${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">
            <BrandIcon />
          </div>
          <div className="logo-text-wrap">
            <span className="logo-text">{t('appName')}</span>
            <span className="logo-tagline">{t('appTagline')}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">{t('menuMain')}</div>
          {showDashboard && (
            <NavLink
              to={dashboardNavItem.path}
              title={t('dashboard')}
              className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-item-icon">{navIcons.dashboard}</span>
              <span className="sidebar-item-label">{t('dashboard')}</span>
            </NavLink>
          )}
          {visibleGroups.map((group) => {
            const groupActive = groupPathChecks[group.key](location.pathname);
            const expanded = openGroups[group.key] && !sidebarCollapsed;

            return (
              <div key={group.key} className="sidebar-group">
                <button
                  type="button"
                  className={`sidebar-item sidebar-item-parent${groupActive ? ' active' : ''}`}
                  title={t(group.key)}
                  onClick={() => {
                    if (sidebarCollapsed) {
                      const roles = user?.roles ?? user?.role;
                      const targetPath =
                        group.key === 'projects'
                          ? getDefaultProjectsPath(roles)
                          : (group.children[0]?.path ?? group.path);
                      navigate(targetPath);
                      return;
                    }
                    setOpenGroups((current) => ({
                      ...current,
                      [group.key]: !current[group.key],
                    }));
                  }}
                >
                  <span className="sidebar-item-icon">{navIcons[group.key]}</span>
                  <span className="sidebar-item-label">{t(group.key)}</span>
                  {!sidebarCollapsed && <ChevronIcon expanded={expanded} />}
                </button>

                {expanded && (
                  <div className="sidebar-submenu">
                    {group.children.map(({ key, path }) => (
                      <NavLink
                        key={key}
                        to={path}
                        title={t(key)}
                        className={({ isActive }) => `sidebar-subitem${isActive ? ' active' : ''}`}
                      >
                        {t(key)}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="sidebar-section-label">{t('menuSystem')}</div>
          {secondaryNavItems.map(({ key, path }) => (
            <NavLink
              key={key}
              to={path}
              title={t(key)}
              className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-item-icon">{navIcons[key]}</span>
              <span className="sidebar-item-label">{t(key)}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="sidebar-collapse"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? t('expandMenu') : t('collapseMenu')}
          title={sidebarCollapsed ? t('expandMenu') : t('collapseMenu')}
        >
          <CollapseIcon collapsed={sidebarCollapsed} />
          <span>{sidebarCollapsed ? t('expandMenu') : t('collapseMenu')}</span>
        </button>
      </aside>

      <div className="dashboard-main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-breadcrumb">
              {t('appName')} / <span>{breadcrumb}</span>
            </div>
            <div className="topbar-page-label">{breadcrumb}</div>
          </div>

          <div className="topbar-user">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <span className="user-name">
                {user?.username ?? 'XKA'} – {user?.fullName ?? ''}
              </span>
              <span className="user-role">{t(roleLabelKey)}</span>
            </div>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              <PowerIcon />
              {t('logout')}
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const navIcons: Record<string, ReactNode> = {
  dashboard: <DashboardIcon />,
  scheduling: <CalendarIcon />,
  transcripts: <DocumentIcon />,
  projects: <FolderIcon />,
  financials: <ChartIcon />,
  administration: <SettingsIcon />,
  myProfile: <UserIcon />,
  aboutApp: <InfoIcon />,
};

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`sidebar-chevron${expanded ? ' expanded' : ''}`}
    >
      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
    </svg>
  );
}

function BrandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path d="M4 19h16M7 16V8m5 8V5m5 11v-6" strokeLinecap="round" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 13h2v8H3v-8zm4-6h2v14H7V7zm4-4h2v18h-2V3zm4 8h2v10h-2V11zm4-6h2v16h-2V5z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={collapsed ? 'collapse-icon collapse-icon-expanded' : 'collapse-icon'}
    >
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z" />
    </svg>
  );
}
