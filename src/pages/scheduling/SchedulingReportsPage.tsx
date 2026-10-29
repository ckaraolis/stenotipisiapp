import StenotypistSummaryReportTable from '../../components/scheduling/StenotypistSummaryReportTable';
import StenotypistAssignmentsPerDistrictReportTable from '../../components/scheduling/StenotypistAssignmentsPerDistrictReportTable';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/dashboard.css';
import '../../styles/scheduling-reports.css';

export default function SchedulingReportsPage() {
  const { t } = useLanguage();

  return (
    <div className="scheduling-reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('schedulingReports')}</h1>
          <p className="page-subtitle">{t('schedulingReportsSubtitle')}</p>
        </div>
      </div>

      <div className="report-section">
        <div className="report-section-header">
          <h2 className="report-section-title">{t('stenotypistSummaryReport')}</h2>
          <p className="report-section-subtitle">{t('stenotypistSummaryGeneralSheet')}</p>
        </div>
        <StenotypistSummaryReportTable />
      </div>

      <div className="report-section">
        <div className="report-section-header">
          <h2 className="report-section-title">{t('assignmentsPerDistrictReport')}</h2>
          <p className="report-section-subtitle">{t('assignmentsPerDistrictSubtitle')}</p>
        </div>
        <StenotypistAssignmentsPerDistrictReportTable />
      </div>
    </div>
  );
}
