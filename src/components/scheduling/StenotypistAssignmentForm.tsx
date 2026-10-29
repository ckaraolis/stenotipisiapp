import { useEffect, useMemo, useState } from 'react';
import {
  assignJob,
  fetchJobStenotypistCandidates,
  type JobStenotypistCandidate,
} from '../../api/jobs';
import { useLanguage } from '../../i18n/LanguageContext';
import { parseJobActionError } from './JobRejectDialog';
import '../../styles/profile.css';
import '../../styles/scheduling.css';

interface StenotypistAssignmentFormProps {
  jobId: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

function formatStenotypistLabel(candidate: JobStenotypistCandidate): string {
  if (candidate.username && candidate.fullName) {
    return `${candidate.username} – ${candidate.fullName}`;
  }
  return candidate.fullName || candidate.username || '—';
}

export default function StenotypistAssignmentForm({
  jobId,
  onCancel,
  onSaved,
}: StenotypistAssignmentFormProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<JobStenotypistCandidate[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    fetchJobStenotypistCandidates()
      .then((stenotypists) => {
        if (!active) return;
        setCandidates(stenotypists);
      })
      .catch((err) => {
        if (!active) return;
        setError(parseJobActionError((err as Error).message, t, 'jobStenotypistCandidatesLoadError'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [t]);

  const sortedCandidates = useMemo(
    () =>
      [...candidates].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }),
      ),
    [candidates],
  );

  const handleSelect = async (candidate: JobStenotypistCandidate) => {
    if (assigningId) return;

    setAssigningId(candidate.id);
    setError('');
    try {
      await assignJob(jobId, { stenotypistUserId: candidate.id });
      onSaved(t('jobAssignedSuccess'));
    } catch (err) {
      setError(parseJobActionError((err as Error).message, t, 'jobSaveError'));
      setAssigningId(null);
    }
  };

  return (
    <div className="profile-form user-details-form">
      <h2>{t('assignJobTitle')}</h2>
      <p className="profile-field-hint">{t('assignJobDescription')}</p>

      {error && <div className="profile-alert profile-alert-error">{error}</div>}

      {loading ? (
        <div className="profile-message">{t('loading')}</div>
      ) : sortedCandidates.length === 0 ? (
        <div className="profile-message">{t('noStenotypistsFound')}</div>
      ) : (
        <ul className="stenotypist-assignment-list">
          {sortedCandidates.map((candidate) => {
            const isAssigning = assigningId === candidate.id;
            const isDisabled = assigningId !== null && !isAssigning;

            return (
              <li key={candidate.id}>
                <button
                  type="button"
                  className="stenotypist-assignment-item"
                  disabled={isDisabled}
                  onClick={() => void handleSelect(candidate)}
                >
                  <span className="stenotypist-assignment-name">
                    {formatStenotypistLabel(candidate)}
                  </span>
                  {isAssigning ? (
                    <span className="stenotypist-assignment-status">{t('saving')}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="profile-actions">
        <button
          type="button"
          className="profile-cancel-btn"
          onClick={onCancel}
          disabled={assigningId !== null}
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
