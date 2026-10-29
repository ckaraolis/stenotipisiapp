import { useState, type FormEvent } from 'react';
import { publishTranscriptWorkflow } from '../../api/transcripts';
import type { TranscriptRecord } from '../../types/transcript';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface PublishTranscriptDialogProps {
  transcript: TranscriptRecord;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

function parseApiErrors(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('transcriptWorkflowSaveError');
}

export default function PublishTranscriptDialog({
  transcript,
  onCancel,
  onSaved,
}: PublishTranscriptDialogProps) {
  const { t } = useLanguage();
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await publishTranscriptWorkflow(transcript.id, {
        publisherRemarks: remarks.trim(),
      });
      const message = result.messages.map((key) => t(key as TranslationKey)).join(' ');
      onSaved(message || t('transcriptPublishedSuccess'));
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-overlay" role="presentation" onClick={onCancel}>
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-transcript-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="publish-transcript-title">
          {t('transcriptPublishDialogTitle').replace('{jobNumber}', transcript.jobNumber)}
        </h2>
        <p className="profile-field-hint">{t('transcriptPublishDialogHint')}</p>
        <form onSubmit={handleSubmit} noValidate>
          {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}
          <label className="profile-label" htmlFor="publisher-remarks">
            {t('publisherRemarks')}
          </label>
          <textarea
            id="publisher-remarks"
            className="profile-input profile-textarea"
            rows={4}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
