import { useRef } from 'react';
import {
  REVIEWED_TRANSCRIPT_FILE_ACCEPT,
  validateReviewedTranscriptFileName,
} from '../../../config/reviewedTranscriptWorkflow';
import { useLanguage } from '../../../i18n/LanguageContext';
import type { TranslationKey } from '../../../i18n/translations';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface ReviewedTranscriptUploadFormProps {
  jobNumber: string;
  selectedFile: File | null;
  remarks: string;
  onFileChange: (file: File | null) => void;
  onRemarksChange: (remarks: string) => void;
  error?: string;
  onError: (message: string) => void;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReviewedTranscriptUploadForm({
  jobNumber,
  selectedFile,
  remarks,
  onFileChange,
  onRemarksChange,
  error,
  onError,
}: ReviewedTranscriptUploadFormProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBrowse = () => {
    onError('');
    inputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;

    const validationError = validateReviewedTranscriptFileName(jobNumber, file.name);
    if (validationError) {
      onError(t(validationError as TranslationKey));
      return;
    }

    onError('');
    onFileChange(file);
  };

  return (
    <div className="profile-form">
      <h3 className="workflow-wizard-step-title">{t('transcriptReviewedStepUpload')}</h3>
      <p className="workflow-wizard-step-description">{t('transcriptReviewedStepUploadDescription')}</p>

      {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

      <div className="profile-grid">
        <label className="profile-label">{t('transcriptReviewedTranscriptUpload')}</label>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={REVIEWED_TRANSCRIPT_FILE_ACCEPT}
            hidden
            onChange={handleFileSelected}
          />
          <button type="button" className="btn-secondary" onClick={handleBrowse}>
            {t('transcriptReviewedTranscriptUpload')}
          </button>
          {selectedFile ? (
            <p className="profile-field-hint">
              {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </p>
          ) : (
            <p className="profile-field-hint">{t('noFileSelected')}</p>
          )}
        </div>

        <label className="profile-label" htmlFor="reviewed-transcript-remarks">
          {t('reviewRemarks')}
        </label>
        <textarea
          id="reviewed-transcript-remarks"
          className="profile-input profile-textarea"
          rows={4}
          value={remarks}
          onChange={(event) => onRemarksChange(event.target.value)}
        />
      </div>

      <p className="profile-field-hint">{t('transcriptReviewedTranscriptFilenameInvalid')}</p>
    </div>
  );
}
