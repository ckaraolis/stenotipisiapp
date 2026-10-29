import { useRef } from 'react';
import {
  acceptFilterForRawFileSlot,
  emptyRawFilesBundle,
  validateRawFileName,
  type JobSubmissionRawFileSlot,
} from '../../../config/jobSubmissionRawFiles';
import type { JobSubmissionFileEntry, JobSubmissionRawFilesBundle } from '../../../types/jobSubmission';
import { useLanguage } from '../../../i18n/LanguageContext';
import type { TranslationKey } from '../../../i18n/translations';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface RawFilesUploadFormProps {
  jobNumber: string;
  rawFiles: JobSubmissionRawFilesBundle;
  onChange: (rawFiles: JobSubmissionRawFilesBundle) => void;
  error?: string;
  onError: (message: string) => void;
}

type SlotConfig = {
  slot: JobSubmissionRawFileSlot;
  labelKey: TranslationKey;
  fieldKey: keyof JobSubmissionRawFilesBundle;
};

const SLOT_CONFIG: SlotConfig[] = [
  { slot: 'raw_zip', labelKey: 'jobSubmissionRawFilesUpload', fieldKey: 'rawZip' },
  {
    slot: 'transcript_timestamps',
    labelKey: 'jobSubmissionTranscriptTimestampsUpload',
    fieldKey: 'transcriptWithTimestamps',
  },
  { slot: 'transcript_rtf', labelKey: 'jobSubmissionTranscriptUpload', fieldKey: 'transcript' },
];

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function createFileEntry(
  file: File,
  slot: JobSubmissionRawFileSlot,
): Promise<JobSubmissionFileEntry> {
  const entry: JobSubmissionFileEntry = {
    id: `file-${crypto.randomUUID().slice(0, 8)}`,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
  };

  if (slot === 'transcript_rtf' || slot === 'transcript_timestamps') {
    try {
      entry.textContent = await readFileAsText(file);
    } catch {
      entry.textContent = '';
    }
  }

  return entry;
}

export default function RawFilesUploadForm({
  jobNumber,
  rawFiles,
  onChange,
  error,
  onError,
}: RawFilesUploadFormProps) {
  const { t } = useLanguage();
  const inputRefs = useRef<Record<JobSubmissionRawFileSlot, HTMLInputElement | null>>({
    raw_zip: null,
    transcript_timestamps: null,
    transcript_rtf: null,
  });

  const handleBrowse = (slot: JobSubmissionRawFileSlot) => {
    onError('');
    inputRefs.current[slot]?.click();
  };

  const handleFileSelected = async (
    slot: JobSubmissionRawFileSlot,
    fieldKey: keyof JobSubmissionRawFilesBundle,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateRawFileName(jobNumber, file.name, slot);
    if (validationError) {
      onError(t(validationError as TranslationKey));
      return;
    }

    onError('');
    try {
      const entry = await createFileEntry(file, slot);
      onChange({
        ...rawFiles,
        [fieldKey]: entry,
      });
    } catch {
      onError(t('jobSubmissionFileReadError'));
    }
  };

  const handleClearAll = () => {
    onError('');
    onChange(emptyRawFilesBundle());
  };

  return (
    <div className="profile-form">
      <h3 className="workflow-wizard-step-title">{t('jobSubmissionStepRawFiles')}</h3>
      <p className="workflow-wizard-step-description">{t('jobSubmissionStepRawFilesDescription')}</p>

      {error && <div className="profile-alert profile-alert-error">{error}</div>}

      <div className="profile-grid">
        {SLOT_CONFIG.map(({ slot, labelKey, fieldKey }) => {
          const file = rawFiles[fieldKey];
          return (
            <div key={slot} style={{ display: 'contents' }}>
              <label className="profile-label">{t(labelKey)}</label>
              <div>
                <input
                  ref={(element) => {
                    inputRefs.current[slot] = element;
                  }}
                  type="file"
                  accept={acceptFilterForRawFileSlot(slot)}
                  hidden
                  onChange={(event) => handleFileSelected(slot, fieldKey, event)}
                />
                <button type="button" className="btn-secondary" onClick={() => handleBrowse(slot)}>
                  {t(labelKey)}
                </button>
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

      <p className="profile-field-hint">{t('jobSubmissionRawFileNamingHint')}</p>
    </div>
  );
}
