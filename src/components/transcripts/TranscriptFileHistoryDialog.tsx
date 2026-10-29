import { useEffect, useState } from 'react';
import { fetchTranscriptFileHistory } from '../../api/transcriptFiles';
import { formatTranscriptFileSize } from '../../config/transcriptFiles';
import type { TranscriptFileListItem, TranscriptFileVersion } from '../../types/transcript';
import { useLanguage } from '../../i18n/LanguageContext';
import '../../styles/profile.css';
import '../../styles/projects.css';

interface TranscriptFileHistoryDialogProps {
  transcriptId: string;
  file: TranscriptFileListItem;
  onClose: () => void;
}

export default function TranscriptFileHistoryDialog({
  transcriptId,
  file,
  onClose,
}: TranscriptFileHistoryDialogProps) {
  const { t } = useLanguage();
  const [history, setHistory] = useState<TranscriptFileVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const rows = await fetchTranscriptFileHistory(transcriptId, file.slot, file.fileId);
        if (!cancelled) {
          setHistory(rows);
        }
      } catch {
        if (!cancelled) {
          setError(t('transcriptFileHistoryLoadError'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [transcriptId, file.slot, file.fileId, t]);

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card dialog-card-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transcript-file-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="transcript-file-history-title">{t('transcriptFileHistoryTitle')}</h2>
        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
        <div className="table-wrapper">
          <table className="projects-table">
            <thead>
              <tr>
                <th>{t('fileName')}</th>
                <th>{t('fileDescription')}</th>
                <th>{t('fileSize')}</th>
                <th>{t('uploadedAt')}</th>
                <th>{t('uploadedBy')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty-row">
                    {t('loading')}
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">
                    {t('transcriptFileHistoryEmpty')}
                  </td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.name}</td>
                    <td>{entry.description || '—'}</td>
                    <td>{formatTranscriptFileSize(entry.size)}</td>
                    <td>{formatUploadedAt(entry.uploadedAt)}</td>
                    <td>{entry.uploadedByName || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatUploadedAt(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
