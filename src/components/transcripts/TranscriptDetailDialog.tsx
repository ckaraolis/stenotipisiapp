import { formatEditDuration } from '../../config/transcriptData';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranscriptRecord } from '../../types/transcript';
import '../../styles/profile.css';

interface TranscriptDetailDialogProps {
  transcript: TranscriptRecord;
  onClose: () => void;
}

function displayValue(value: string | number | boolean | null | undefined): string {
  if (typeof value === 'boolean') {
    return value ? '✓' : '—';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return '—';
}

function formatEditDurationDetail(
  transcript: TranscriptRecord,
  minutesLabel: string,
): string {
  const total = `${formatEditDuration(transcript.editDurationMinutes)} ${minutesLabel}`;
  if (!transcript.editDurationSegments.length) {
    return total;
  }
  const breakdown = transcript.editDurationSegments
    .map((segment) => `Duration-${segment.index}: ${formatEditDuration(segment.minutes)}`)
    .join(', ');
  return `${total} (${breakdown})`;
}

export default function TranscriptDetailDialog({
  transcript,
  onClose,
}: TranscriptDetailDialogProps) {
  const { t } = useLanguage();

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card transcript-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transcript-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="transcript-detail-title">
          {t('transcriptDetailTitle').replace('{jobNumber}', transcript.jobNumber)}
        </h2>
        <div className="dialog-body transcript-detail-grid">
          <DetailField label={t('jobNumber')} value={transcript.jobNumber} />
          <DetailField label={t('editor')} value={transcript.editorName} />
          <DetailField label={t('editorRemarks')} value={transcript.editorRemarks} />
          <DetailField label={t('reviewer')} value={transcript.reviewerName} />
          <DetailField label={t('reviewerRemarks')} value={transcript.reviewerRemarks} />
          <DetailField label={t('publisher')} value={transcript.publisherName} />
          <DetailField label={t('publisherRemarks')} value={transcript.publisherRemarks} />
          <DetailField
            label={t('editDuration')}
            value={formatEditDurationDetail(transcript, t('minutes'))}
          />
          <DetailField label={t('reviewStartTime')} value={transcript.reviewStartTime} />
          <DetailField label={t('reviewEndTime')} value={transcript.reviewEndTime} />
          <DetailField label={t('bypassApproval')} value={displayValue(transcript.bypassApproval)} />
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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="transcript-detail-field">
      <span className="transcript-detail-label">{label}</span>
      <span className="transcript-detail-value">{value}</span>
    </div>
  );
}
