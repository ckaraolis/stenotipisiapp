import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchTranscriptOwnerCandidates,
  type TranscriptOwnerCandidate,
} from '../../api/projects';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';
import '../../styles/projects.css';

interface AddTranscriptOwnerDialogProps {
  customerId: string;
  assignedOwnerIds: string[];
  onClose: () => void;
  onAdd: (user: TranscriptOwnerCandidate) => Promise<void>;
}

type SortDirection = 'asc' | 'desc';

export default function AddTranscriptOwnerDialog({
  customerId,
  assignedOwnerIds,
  onClose,
  onAdd,
}: AddTranscriptOwnerDialogProps) {
  const { t } = useLanguage();
  const [candidates, setCandidates] = useState<TranscriptOwnerCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [sortDirection] = useState<SortDirection>('asc');

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTranscriptOwnerCandidates(customerId, assignedOwnerIds);
      setCandidates(data);
    } catch {
      setError(t('projectTranscriptOwnerCandidatesLoadError'));
    } finally {
      setLoading(false);
    }
  }, [assignedOwnerIds, customerId, t]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const sortedRows = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const comparison = a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [candidates, sortDirection]);

  const handleAdd = async (user: TranscriptOwnerCandidate) => {
    setAddingUserId(user.id);
    setError('');
    try {
      await onAdd(user);
      await loadCandidates();
    } catch {
      setError(t('projectTranscriptOwnerAddError'));
    } finally {
      setAddingUserId(null);
    }
  };

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card dialog-card-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-transcript-owner-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-card-header">
          <h2 id="add-transcript-owner-title">{t('addTranscriptOwnersTitle')}</h2>
          <button type="button" className="profile-cancel-btn" onClick={onClose}>
            {t('close')}
          </button>
        </div>

        {error && <div className="profile-alert profile-alert-error">{error}</div>}

        {loading ? (
          <div className="profile-message">{t('loading')}</div>
        ) : (
          <div className="table-wrapper">
            <table className="projects-table">
              <thead>
                <tr>
                  <th className="sorted-col">
                    {t('fullName')}
                    <SortIcon direction={sortDirection} />
                  </th>
                  <th>{t('alias')}</th>
                  <th>{t('emailAddress')}</th>
                  <th className="actions-col">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-row">
                      {t('noRecordsFound')}
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.fullName}</td>
                      <td>{row.username}</td>
                      <td>{row.email}</td>
                      <td className="actions-col">
                        <div className="row-actions">
                          <button
                            type="button"
                            disabled={addingUserId === row.id}
                            onClick={() => void handleAdd(row)}
                          >
                            {addingUserId === row.id ? t('saving') : t('add')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SortIcon({ direction }: { direction: SortDirection }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`sort-icon${direction === 'desc' ? ' sort-icon-desc' : ''}`}
    >
      <path d="M7 14l5-5 5 5z" />
    </svg>
  );
}
