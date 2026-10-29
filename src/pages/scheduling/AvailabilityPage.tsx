import { mockAvailability } from '../../data/mockScheduling';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/scheduling.css';

export default function AvailabilityPage() {
  const { t } = useLanguage();

  return (
    <div className="scheduling-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('availability')}</h1>
          <p className="page-subtitle">{t('availabilitySubtitle')}</p>
        </div>
        <button type="button" className="btn-primary">{t('addNew')}</button>
      </div>

      <div className="scheduling-panel">
        <div className="table-wrapper">
          <table className="scheduling-table">
            <thead>
              <tr>
                <th>{t('stenotypist')}</th>
                <th>{t('district')}</th>
                <th>{t('date')}</th>
                <th>{t('from')}</th>
                <th>{t('until')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {mockAvailability.map((row) => (
                <tr key={`${row.stenotypist}-${row.date}`}>
                  <td>{row.stenotypist}</td>
                  <td>{row.district}</td>
                  <td>{row.date}</td>
                  <td>{row.from}</td>
                  <td>{row.to}</td>
                  <td>
                    <span
                      className={`status-pill status-${row.status.toLowerCase()}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
