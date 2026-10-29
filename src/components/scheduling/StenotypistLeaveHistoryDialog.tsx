import {
  formatRequestedOn,
  stenotypistLeaveStatusLabelKey,
} from '../../config/stenotypistLeave';
import type { StenotypistLeaveHistoryEntry, StenotypistLeaveRecord } from '../../types/stenotypistLeave';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';
import '../../styles/projects.css';

interface StenotypistLeaveHistoryDialogProps {
  leave: StenotypistLeaveRecord;
  onClose: () => void;
}

function sortHistory(entries: StenotypistLeaveHistoryEntry[]): StenotypistLeaveHistoryEntry[] {
  return [...entries].sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

export default function StenotypistLeaveHistoryDialog({
  leave,
  onClose,
}: StenotypistLeaveHistoryDialogProps) {
  const { t } = useLanguage();
  const historyRows = sortHistory(leave.history ?? []);

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card dialog-card-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stenotypist-leave-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="stenotypist-leave-history-title">{t('stenotypistLeaveHistoryTitle')}</h2>

        <div className="table-wrapper">
          <table className="projects-table">
            <thead>
              <tr>
                <th>{t('status')}</th>
                <th>{t('changedAt')}</th>
                <th>{t('changedBy')}</th>
                <th>{t('notes')}</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-row">
                    {t('noRecordsFound')}
                  </td>
                </tr>
              ) : (
                historyRows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{t(stenotypistLeaveStatusLabelKey(entry.status))}</td>
                    <td>{formatRequestedOn(entry.changedAt)}</td>
                    <td>{entry.changedByName || '—'}</td>
                    <td>{entry.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="dialog-actions">
          <button type="button" className="profile-cancel-btn" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
