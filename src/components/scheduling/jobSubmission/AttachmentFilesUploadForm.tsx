import { useRef } from 'react';
import {
  acceptFilterForAttachmentFileSlot,
  emptyAttachmentFilesBundle,
  validateAttachmentFileName,
  type JobSubmissionAttachmentFileSlot,
} from '../../../config/jobSubmissionAttachmentFiles';
import type {
  JobSubmissionAttachmentFilesBundle,
  JobSubmissionFileEntry,
} from '../../../types/jobSubmission';
import { useLanguage } from '../../../i18n/LanguageContext';
import type { TranslationKey } from '../../../i18n/translations';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface AttachmentFilesUploadFormProps {
  jobNumber: string;
  attachmentFiles: JobSubmissionAttachmentFilesBundle;
  onChange: (attachmentFiles: JobSubmissionAttachmentFilesBundle) => void;
  error?: string;
  onError: (message: string) => void;
}

type SlotConfig = {
  slot: JobSubmissionAttachmentFileSlot;
  uploadLabelKey: TranslationKey;
  removeLabelKey: TranslationKey;
  fieldKey: keyof JobSubmissionAttachmentFilesBundle;
};

const SLOT_CONFIG: SlotConfig[] = [
  {
    slot: 'personal_dictionary',
    uploadLabelKey: 'jobSubmissionPersonalDictionaryUpload',
    removeLabelKey: 'jobSubmissionPersonalDictionaryRemove',
    fieldKey: 'personalDictionary',
  },
  {
    slot: 'evidence_list',
    uploadLabelKey: 'jobSubmissionEvidenceListUpload',
    removeLabelKey: 'jobSubmissionEvidenceListRemove',
    fieldKey: 'evidenceList',
  },
];

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function createFileEntry(file: File): JobSubmissionFileEntry {
  return {
    id: `file-${crypto.randomUUID().slice(0, 8)}`,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
  };
}

export default function AttachmentFilesUploadForm({
  jobNumber,
  attachmentFiles,
  onChange,
  error,
  onError,
}: AttachmentFilesUploadFormProps) {
  const { t } = useLanguage();
  const inputRefs = useRef<Record<JobSubmissionAttachmentFileSlot, HTMLInputElement | null>>({
    personal_dictionary: null,
    evidence_list: null,
  });

  const handleBrowse = (slot: JobSubmissionAttachmentFileSlot) => {
    onError('');
    inputRefs.current[slot]?.click();
  };

  const handleFileSelected = (
    slot: JobSubmissionAttachmentFileSlot,
    fieldKey: keyof JobSubmissionAttachmentFilesBundle,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateAttachmentFileName(jobNumber, file.name, slot);
    if (validationError) {
      onError(t(validationError as TranslationKey));
      return;
    }

    onError('');
    onChange({
      ...attachmentFiles,
      [fieldKey]: createFileEntry(file),
    });
  };

  const handleRemove = (fieldKey: keyof JobSubmissionAttachmentFilesBundle) => {
    onError('');
    onChange({
      ...attachmentFiles,
      [fieldKey]: null,
    });
  };

  const handleClearAll = () => {
    onError('');
    onChange(emptyAttachmentFilesBundle());
  };

  return (
    <div className="profile-form">
      <h3 className="workflow-wizard-step-title">{t('jobSubmissionStepAttachmentFiles')}</h3>
      <p className="workflow-wizard-step-description">
        {t('jobSubmissionStepAttachmentFilesDescription')}
      </p>

      {error && <div className="profile-alert profile-alert-error">{error}</div>}

      <div className="profile-grid">
        {SLOT_CONFIG.map(({ slot, uploadLabelKey, removeLabelKey, fieldKey }) => {
          const file = attachmentFiles[fieldKey];
          return (
            <div key={slot} style={{ display: 'contents' }}>
              <label className="profile-label">{t(uploadLabelKey)}</label>
              <div>
                <input
                  ref={(element) => {
                    inputRefs.current[slot] = element;
                  }}
                  type="file"
                  accept={acceptFilterForAttachmentFileSlot(slot)}
                  hidden
                  onChange={(event) => handleFileSelected(slot, fieldKey, event)}
                />
                <div className="workflow-wizard-file-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleBrowse(slot)}
                  >
                    {t(uploadLabelKey)}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleRemove(fieldKey)}
                    disabled={!file}
                  >
                    {t(removeLabelKey)}
                  </button>
                </div>
                {file ? (
                  <p className="profile-field-hint">
                    {file.name} ({formatFileSize(file.size)})
                  </p>
                ) : (
                  <p className="profile-field-hint">{t('noFileSelected')}</p>
                )}
              </div>
            </div>
          );
        })}

        <label className="profile-label">{t('clearAll')}</label>
        <div>
          <button type="button" className="btn-secondary" onClick={handleClearAll}>
            {t('clearAll')}
          </button>
        </div>
      </div>

      <p className="profile-field-hint">{t('jobSubmissionAttachmentFileNamingHint')}</p>
    </div>
  );
}
