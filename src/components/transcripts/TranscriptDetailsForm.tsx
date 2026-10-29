import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  fetchTranscriptById,
  fetchTranscriptParticipantOptions,
  updateTranscript,
} from '../../api/transcripts';
import {
  canEditTranscriptDetails,
  computeTranscriptDeadlineMinutes,
  formatTranscriptDeadline,
  formatTranscriptJobStatus,
} from '../../config/transcriptDetails';
import type {
  TranscriptParticipantCandidate,
  TranscriptPublisherCandidate,
  TranscriptRecord,
} from '../../types/transcript';
import { getAuthUser } from '../../utils/auth';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';

interface TranscriptDetailsFormProps {
  transcriptId: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type TranscriptFormState = {
  editorUserId: string;
  reviewerUserId: string;
  publisherUserId: string;
  expedite: boolean;
  bypassApproval: boolean;
  specialNotes: string;
};

const EMPTY_FORM: TranscriptFormState = {
  editorUserId: '',
  reviewerUserId: '',
  publisherUserId: '',
  expedite: false,
  bypassApproval: false,
  specialNotes: '',
};

function parseApiErrors(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('transcriptSaveError');
}

function formatParticipantLabel(candidate: TranscriptParticipantCandidate): string {
  if (candidate.fullName && candidate.username) {
    return `${candidate.fullName} (${candidate.username})`;
  }
  return candidate.fullName || candidate.username || candidate.id;
}

function formatPublisherLabel(candidate: TranscriptPublisherCandidate): string {
  if (candidate.fullName && candidate.username) {
    return `${candidate.fullName} (${candidate.username})`;
  }
  return candidate.fullName || candidate.username || candidate.id;
}

export default function TranscriptDetailsForm({
  transcriptId,
  onCancel,
  onSaved,
}: TranscriptDetailsFormProps) {
  const { t } = useLanguage();
  const authUser = getAuthUser();
  const canEdit = canEditTranscriptDetails(authUser?.roles ?? authUser?.role);

  const [transcript, setTranscript] = useState<TranscriptRecord | null>(null);
  const [form, setForm] = useState<TranscriptFormState>(EMPTY_FORM);
  const [participants, setParticipants] = useState<TranscriptParticipantCandidate[]>([]);
  const [publishers, setPublishers] = useState<TranscriptPublisherCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deadlineTick, setDeadlineTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [record, options] = await Promise.all([
          fetchTranscriptById(transcriptId),
          canEdit ? fetchTranscriptParticipantOptions() : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setTranscript(record);
        setForm({
          editorUserId: record.editorUserId ?? '',
          reviewerUserId: record.reviewerUserId ?? '',
          publisherUserId: record.publisherUserId ?? '',
          expedite: record.expedite === true,
          bypassApproval: record.bypassApproval === true,
          specialNotes: record.specialNotes ?? '',
        });
        if (options) {
          setParticipants(options.participants);
          setPublishers(options.publishers);
        }
      } catch {
        if (!cancelled) {
          setError(t('transcriptsLoadError'));
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
  }, [transcriptId, canEdit, t]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDeadlineTick((current) => current + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const deadlineMinutes = useMemo(() => {
    if (!transcript) return null;
    return computeTranscriptDeadlineMinutes(
      transcript.date,
      transcript.jobEndTime || transcript.endTimeStenotypist,
      transcript.serviceLevelAgreement,
      form.expedite,
    );
  }, [transcript, form.expedite, deadlineTick]);

  const deadlineLabel = formatTranscriptDeadline(deadlineMinutes, t);

  const buildPayload = () => ({
    editorUserId: form.editorUserId.trim(),
    reviewerUserId: form.reviewerUserId.trim(),
    publisherUserId: form.publisherUserId.trim(),
    expedite: form.expedite,
    bypassApproval: form.bypassApproval,
    specialNotes: form.specialNotes.trim(),
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    setError('');
    setSaving(true);
    try {
      const result = await updateTranscript(transcriptId, buildPayload());
      const message = result.messages
        .map((key) => t(key as TranslationKey))
        .join(' ');
      onSaved(message || t('transcriptUpdatedSuccess'));
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof TranscriptFormState>(key: K, value: TranscriptFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  if (loading) {
    return <div className="profile-message">{t('loading')}</div>;
  }

  if (!transcript) {
    return <div className="profile-message">{t('transcriptNotFound')}</div>;
  }

  const stenotypistLabel =
    transcript.stenotypistAlias || transcript.stenotypistName || '—';
  const jobStatusLabel = formatTranscriptJobStatus(transcript.jobStatus, t);
  const jobEndTimeLabel = transcript.jobEndTime || transcript.endTimeStenotypist || '—';

  return (
    <div className="user-details-form">
      <div className="profile-card">
        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          <div className="user-details-header">
            <h2>
              {t('transcriptDetailsFormTitle').replace('{jobNumber}', transcript.jobNumber)}
            </h2>
          </div>

          {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="transcript-job-number">
              {t('jobNumber')}
            </label>
            <input
              id="transcript-job-number"
              type="text"
              className="profile-input"
              value={transcript.jobNumber}
              readOnly
            />

            <label className="profile-label" htmlFor="transcript-status">
              {t('status')}
            </label>
            <input
              id="transcript-status"
              type="text"
              className="profile-input"
              value={jobStatusLabel}
              readOnly
            />

            <label className="profile-label" htmlFor="transcript-customer">
              {t('customer')}
            </label>
            <input
              id="transcript-customer"
              type="text"
              className="profile-input"
              value={transcript.customerName || '—'}
              readOnly
            />

            <label className="profile-label" htmlFor="transcript-project">
              {t('project')}
            </label>
            <input
              id="transcript-project"
              type="text"
              className="profile-input"
              value={transcript.projectNumber || '—'}
              readOnly
            />

            <label className="profile-label" htmlFor="transcript-stenotypist">
              {t('stenotypist')}
            </label>
            <input
              id="transcript-stenotypist"
              type="text"
              className="profile-input"
              value={stenotypistLabel}
              readOnly
            />

            <label className="profile-label" htmlFor="transcript-editor">
              {t('editor')}
            </label>
            {canEdit ? (
              <select
                id="transcript-editor"
                className="profile-input"
                value={form.editorUserId}
                onChange={(event) => updateField('editorUserId', event.target.value)}
              >
                <option value="">{t('selectOption')}</option>
                {participants.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {formatParticipantLabel(candidate)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="transcript-editor"
                type="text"
                className="profile-input"
                value={transcript.editorName || '—'}
                readOnly
              />
            )}

            <label className="profile-label" htmlFor="transcript-editor-remarks">
              {t('editorRemarks')}
            </label>
            <textarea
              id="transcript-editor-remarks"
              className="profile-input profile-textarea"
              rows={3}
              value={transcript.editorRemarks || ''}
              readOnly
            />

            <label className="profile-label" htmlFor="transcript-reviewer">
              {t('reviewer')}
            </label>
            {canEdit ? (
              <select
                id="transcript-reviewer"
                className="profile-input"
                value={form.reviewerUserId}
                onChange={(event) => updateField('reviewerUserId', event.target.value)}
              >
                <option value="">{t('selectOption')}</option>
                {participants.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {formatParticipantLabel(candidate)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="transcript-reviewer"
                type="text"
                className="profile-input"
                value={transcript.reviewerName || '—'}
                readOnly
              />
            )}

            <label className="profile-label" htmlFor="transcript-reviewer-remarks">
              {t('reviewerRemarks')}
            </label>
            <textarea
              id="transcript-reviewer-remarks"
              className="profile-input profile-textarea"
              rows={3}
              value={transcript.reviewerRemarks || ''}
              readOnly
            />

            <label className="profile-label" htmlFor="transcript-publisher">
              {t('publisher')}
            </label>
            {canEdit ? (
              <select
                id="transcript-publisher"
                className="profile-input"
                value={form.publisherUserId}
                onChange={(event) => updateField('publisherUserId', event.target.value)}
              >
                <option value="">{t('selectOption')}</option>
                {publishers.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {formatPublisherLabel(candidate)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="transcript-publisher"
                type="text"
                className="profile-input"
                value={transcript.publisherName || '—'}
                readOnly
              />
            )}

            <label className="profile-label" htmlFor="transcript-publisher-remarks">
              {t('publisherRemarks')}
            </label>
            <textarea
              id="transcript-publisher-remarks"
              className="profile-input profile-textarea"
              rows={3}
              value={transcript.publisherRemarks || ''}
              readOnly
            />

            <label className="profile-label" htmlFor="transcript-expedite">
              {t('expedite')}
            </label>
            <label className="profile-checkbox" htmlFor="transcript-expedite">
              <input
                id="transcript-expedite"
                type="checkbox"
                checked={form.expedite}
                onChange={(event) => updateField('expedite', event.target.checked)}
                disabled={!canEdit}
              />
              <span>{t('expedite')}</span>
            </label>

            <label className="profile-label" htmlFor="transcript-bypass-approval">
              {t('bypassApproval')}
            </label>
            <label className="profile-checkbox" htmlFor="transcript-bypass-approval">
              <input
                id="transcript-bypass-approval"
                type="checkbox"
                checked={form.bypassApproval}
                onChange={(event) => updateField('bypassApproval', event.target.checked)}
                disabled={!canEdit}
              />
              <span>{t('bypassApproval')}</span>
            </label>

            <label className="profile-label" htmlFor="transcript-job-end-time">
              {t('jobEndTime')}
            </label>
            <input
              id="transcript-job-end-time"
              type="text"
              className="profile-input"
              value={jobEndTimeLabel}
              readOnly
            />

            <label className="profile-label" htmlFor="transcript-sla">
              {t('serviceLevelAgreement')}
            </label>
            <input
              id="transcript-sla"
              type="text"
              className="profile-input"
              value={transcript.serviceLevelAgreement || '—'}
              readOnly
            />

            <label className="profile-label" htmlFor="transcript-deadline">
              {t('deadline')}
            </label>
            <input
              id="transcript-deadline"
              type="text"
              className="profile-input"
              value={deadlineLabel}
              readOnly
            />

            <label className="profile-label" htmlFor="transcript-special-notes">
              {t('specialNotes')}
            </label>
            <textarea
              id="transcript-special-notes"
              className="profile-input profile-textarea"
              rows={4}
              value={form.specialNotes}
              onChange={(event) => updateField('specialNotes', event.target.value)}
              readOnly={!canEdit}
            />
          </div>

          <div className="profile-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
              {t('cancel')}
            </button>
            {canEdit ? (
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('saving') : t('save')}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
