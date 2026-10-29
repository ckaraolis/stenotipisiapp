import { mockAudioReviewers } from '../../data/mockScheduling';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/scheduling.css';

export default function AudioReviewersPage() {
  const { t } = useLanguage();

  return (
    <div className="scheduling-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('audioReviewersOnDuty')}</h1>
          <p className="page-subtitle">{t('audioReviewersSubtitle')}</p>
        </div>
      </div>

      <div className="scheduling-panel">
        <div className="table-wrapper">
          <table className="scheduling-table">
            <thead>
              <tr>
                <th>{t('reviewer')}</th>
                <th>{t('district')}</th>
                <th>{t('date')}</th>
                <th>{t('shift')}</th>
                <th>{t('onDuty')}</th>
              </tr>
            </thead>
            <tbody>
              {mockAudioReviewers.map((row) => (
                <tr key={`${row.reviewer}-${row.shift}`}>
                  <td>{row.reviewer}</td>
                  <td>{row.district}</td>
                  <td>{row.date}</td>
                  <td>{row.shift}</td>
                  <td className="center">{row.onDuty ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
