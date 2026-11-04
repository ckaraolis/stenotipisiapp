import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import PermissionRoute from './components/auth/PermissionRoute';
import MyProfilePage from './pages/MyProfilePage';
import PlaceholderPage from './pages/PlaceholderPage';
import SchedulingReportsPage from './pages/scheduling/SchedulingReportsPage';
import UsersPage from './pages/UsersPage';
import SignInPage from './pages/SignInPage';
import StenoRatesPage from './pages/financials/StenoRatesPage';
import TravellingChargesPage from './pages/financials/TravellingChargesPage';
import JobReconciliationPage from './pages/financials/JobReconciliationPage';
import ProformasPage from './pages/financials/ProformasPage';
import BonusConfigurationPage from './pages/financials/BonusConfigurationPage';
import BonusesListPage from './pages/financials/BonusesListPage';
import PenaltyConfigurationPage from './pages/financials/PenaltyConfigurationPage';
import PenaltiesListPage from './pages/financials/PenaltiesListPage';
import TravExpConfigurationPage from './pages/financials/TravExpConfigurationPage';
import TravelExpenseListPage from './pages/financials/TravelExpenseListPage';
import StenotypistFinancialsReportPage from './pages/financials/StenotypistFinancialsReportPage';
import AuditTrailPage from './pages/administration/AuditTrailPage';
import NotificationsPage from './pages/administration/NotificationsPage';
import CustomersPage from './pages/projects/CustomersPage';
import ProjectsListPage from './pages/projects/ProjectsListPage';
import DistrictPage from './pages/projects/DistrictPage';
import TranscriptsStenoPage from './pages/transcripts/TranscriptsStenoPage';
import TranscriptsAnalysisReportPage from './pages/transcripts/TranscriptsAnalysisReportPage';
import JobAllocationPage from './pages/scheduling/JobAllocationPage';
import JobsStenoPage from './pages/scheduling/JobsStenoPage';
import PublicHolidaysPage from './pages/scheduling/PublicHolidaysPage';
import TravellingTimePage from './pages/scheduling/TravellingTimePage';
import StenotypistLeavePage from './pages/scheduling/StenotypistLeavePage';
import { getAuthUser, getPostLoginPath, isAuthenticated } from './utils/auth';
import { getDefaultProjectsPath } from './config/permissions';
import PasswordChangeGuard, { ChangePasswordOnlyRoute } from './components/auth/PasswordChangeGuard';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AccountManagementPage from './pages/AccountManagementPage';
import StenotypistAssetsPage from './pages/StenotypistAssetsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import InactivityMonitor from './components/auth/InactivityMonitor';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/signin" replace />;
  }
  return (
    <>
      <InactivityMonitor />
      {children}
    </>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  if (isAuthenticated()) {
    const user = getAuthUser();
    return <Navigate to={getPostLoginPath(user!)} replace />;
  }
  return children;
}

function DefaultRedirect() {
  const user = getAuthUser();
  if (!user) return <Navigate to="/signin" replace />;
  return <Navigate to={getPostLoginPath(user)} replace />;
}

function ProjectsIndexRedirect() {
  const user = getAuthUser();
  if (!user) return <Navigate to="/signin" replace />;
  return <Navigate to={getDefaultProjectsPath(user.roles ?? user.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/signin"
        element={
          <PublicRoute>
            <SignInPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordOnlyRoute>
              <ChangePasswordPage />
            </ChangePasswordOnlyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <PasswordChangeGuard>
              <DashboardLayout />
            </PasswordChangeGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<DefaultRedirect />} />
        <Route
          path="dashboard"
          element={
            <PermissionRoute>
              <PlaceholderPage titleKey="dashboard" />
            </PermissionRoute>
          }
        />

        <Route path="scheduling" element={<Navigate to="/scheduling/jobs-steno" replace />} />
        <Route
          path="scheduling/jobs-steno"
          element={
            <PermissionRoute>
              <JobsStenoPage />
            </PermissionRoute>
          }
        />
        <Route
          path="scheduling/job-allocation"
          element={
            <PermissionRoute>
              <JobAllocationPage />
            </PermissionRoute>
          }
        />
        <Route
          path="scheduling/stenotypist-leave"
          element={
            <PermissionRoute>
              <StenotypistLeavePage />
            </PermissionRoute>
          }
        />
        <Route
          path="scheduling/public-holidays"
          element={
            <PermissionRoute>
              <PublicHolidaysPage />
            </PermissionRoute>
          }
        />
        <Route
          path="scheduling/travelling-time"
          element={
            <PermissionRoute>
              <TravellingTimePage />
            </PermissionRoute>
          }
        />
        <Route
          path="scheduling/reports"
          element={
            <PermissionRoute>
              <SchedulingReportsPage />
            </PermissionRoute>
          }
        />

        <Route path="transcripts" element={<Navigate to="/transcripts/steno" replace />} />
        <Route
          path="transcripts/steno"
          element={
            <PermissionRoute>
              <TranscriptsStenoPage />
            </PermissionRoute>
          }
        />
        <Route
          path="transcripts/analysis-report"
          element={
            <PermissionRoute>
              <TranscriptsAnalysisReportPage />
            </PermissionRoute>
          }
        />

        <Route path="projects" element={<ProjectsIndexRedirect />} />
        <Route
          path="projects/customers"
          element={
            <PermissionRoute>
              <CustomersPage />
            </PermissionRoute>
          }
        />
        <Route
          path="projects/list"
          element={
            <PermissionRoute>
              <ProjectsListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="projects/district"
          element={
            <PermissionRoute>
              <DistrictPage />
            </PermissionRoute>
          }
        />

        <Route path="financials" element={<Navigate to="/financials/steno-rates" replace />} />
        <Route
          path="financials/steno-rates"
          element={
            <PermissionRoute>
              <StenoRatesPage />
            </PermissionRoute>
          }
        />
        <Route
          path="financials/travelling-charges"
          element={
            <PermissionRoute>
              <TravellingChargesPage />
            </PermissionRoute>
          }
        />
        <Route
          path="financials/reconciliation"
          element={
            <PermissionRoute>
              <JobReconciliationPage />
            </PermissionRoute>
          }
        />
        <Route
          path="financials/proformas"
          element={
            <PermissionRoute>
              <ProformasPage />
            </PermissionRoute>
          }
        />
        <Route
          path="financials/stenotypist-bonus"
          element={
            <PermissionRoute>
              <BonusConfigurationPage />
            </PermissionRoute>
          }
        />
        <Route
          path="financials/stenotypist-bonuses"
          element={
            <PermissionRoute>
              <BonusesListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="financials/stenotypist-penalty"
          element={
            <PermissionRoute>
              <PenaltyConfigurationPage />
            </PermissionRoute>
          }
        />
        <Route
          path="financials/stenotypist-penalties"
          element={
            <PermissionRoute>
              <PenaltiesListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="financials/travel-expenses"
          element={
            <PermissionRoute>
              <TravExpConfigurationPage />
            </PermissionRoute>
          }
        />
        <Route
          path="financials/travel-expense-list"
          element={
            <PermissionRoute>
              <TravelExpenseListPage />
            </PermissionRoute>
          }
        />
        <Route
          path="financials/stenotypist-financials-report"
          element={
            <PermissionRoute>
              <StenotypistFinancialsReportPage />
            </PermissionRoute>
          }
        />

        <Route path="administration" element={<Navigate to="/administration/users" replace />} />
        <Route
          path="administration/users"
          element={
            <PermissionRoute>
              <UsersPage />
            </PermissionRoute>
          }
        />
        <Route
          path="administration/audit-trail"
          element={
            <PermissionRoute>
              <AuditTrailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="administration/account-management"
          element={
            <PermissionRoute>
              <AccountManagementPage />
            </PermissionRoute>
          }
        />
        <Route
          path="administration/notifications"
          element={
            <PermissionRoute>
              <NotificationsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="administration/stenotypist-assets"
          element={
            <PermissionRoute>
              <StenotypistAssetsPage />
            </PermissionRoute>
          }
        />

        <Route path="profile" element={<MyProfilePage />} />
        <Route path="about" element={<PlaceholderPage titleKey="aboutApp" />} />

        <Route path="*" element={<DefaultRedirect />} />
      </Route>
      <Route path="*" element={<Navigate to="/signin" replace />} />
    </Routes>
  );
}
