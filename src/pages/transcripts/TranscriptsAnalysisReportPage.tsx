import TranscriptsAnalysisReportTable from '../../components/transcripts/TranscriptsAnalysisReportTable';
import { useLanguage } from '../../i18n/LanguageContext';

export default function TranscriptsAnalysisReportPage() {
  const { t } = useLanguage();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('transcriptsAnalysisReport')}</h1>
          <p className="page-subtitle">{t('transcriptsAnalysisReportSubtitle')}</p>
        </div>
        <div className="page-header-badge">{t('liveWorkspace')}</div>
      </div>
      <TranscriptsAnalysisReportTable />
    </>
  );
}
