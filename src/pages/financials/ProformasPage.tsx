import ProformaProcessTable from '../../components/financials/ProformaProcessTable';
import ProformasTable from '../../components/financials/ProformasTable';
import { useLanguage } from '../../i18n/LanguageContext';

export default function ProformasPage() {
  const { t } = useLanguage();

  return (
    <>
      <ProformaProcessTable />
      <section className="financials-page proforma-issued-section">
        <div className="page-header financials-header">
          <div>
            <h2 className="page-title page-title-secondary">{t('proformasListTitle')}</h2>
            <p className="page-subtitle">{t('proformasListSubtitle')}</p>
          </div>
        </div>
        <ProformasTable embedded />
      </section>
    </>
  );
}
