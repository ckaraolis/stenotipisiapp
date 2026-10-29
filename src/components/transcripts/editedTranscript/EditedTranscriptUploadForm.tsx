import { useRef } from 'react';
import {
  EDITED_TRANSCRIPT_FILE_ACCEPT,
  validateEditedTranscriptFileName,
} from '../../../config/editedTranscriptWorkflow';
import { useLanguage } from '../../../i18n/LanguageContext';
import type { TranslationKey } from '../../../i18n/translations';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface EditedTranscriptUploadFormProps {
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

export default function EditedTranscriptUploadForm({
  jobNumber,
  selectedFile,
  remarks,
  onFileChange,
  onRemarksChange,
  error,
  onError,
}: EditedTranscriptUploadFormProps) {
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

    const validationError = validateEditedTranscriptFileName(jobNumber, file.name);
    if (validationError) {
      onError(t(validationError as TranslationKey));
      return;
    }

    onError('');
    onFileChange(file);
  };

  return (
    <div className="profile-form">
      <h3 className="workflow-wizard-step-title">{t('transcriptEditedStepUpload')}</h3>
      <p className="workflow-wizard-step-description">{t('transcriptEditedStepUploadDescription')}</p>

      {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

      <div className="profile-grid">
        <label className="profile-label">{t('transcriptEditedTranscriptUpload')}</label>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={EDITED_TRANSCRIPT_FILE_ACCEPT}
            hidden
            onChange={handleFileSelected}
          />
          <button type="button" className="btn-secondary" onClick={handleBrowse}>
            {t('transcriptEditedTranscriptUpload')}
          </button>
          {selectedFile ? (
            <p className="profile-field-hint">
              {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </p>
          ) : (
            <p className="profile-field-hint">{t('noFileSelected')}</p>
          )}
        </div>

        <label className="profile-label" htmlFor="edited-transcript-remarks">
          {t('editorRemarks')}
        </label>
        <textarea
          id="edited-transcript-remarks"
          className="profile-input profile-textarea"
          rows={4}
          value={remarks}
          onChange={(event) => onRemarksChange(event.target.value)}
        />
      </div>

      <p className="profile-field-hint">{t('transcriptEditedTranscriptFilenameInvalid')}</p>
    </div>
  );
}
