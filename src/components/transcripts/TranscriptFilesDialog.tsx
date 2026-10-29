import {
  TRANSCRIPT_FILE_CATEGORIES,
  TRANSCRIPT_FILE_CATEGORY_LABEL_KEYS,
  listTranscriptFilesForCategory,
} from '../../config/transcriptData';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranscriptRecord } from '../../types/transcript';
import '../../styles/profile.css';

interface TranscriptFilesDialogProps {
  transcript: TranscriptRecord;
  onClose: () => void;
}

export default function TranscriptFilesDialog({ transcript, onClose }: TranscriptFilesDialogProps) {
  const { t } = useLanguage();
  const categories = TRANSCRIPT_FILE_CATEGORIES.map((category) => ({
    category,
    labelKey: TRANSCRIPT_FILE_CATEGORY_LABEL_KEYS[category],
    files: listTranscriptFilesForCategory(transcript.files, category),
  }));
  const hasFiles = categories.some((section) => section.files.length > 0);

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card transcript-files-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transcript-files-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="transcript-files-title">
          {t('transcriptFilesTitle').replace('{jobNumber}', transcript.jobNumber)}
        </h2>
        <div className="dialog-body">
          {!hasFiles ? (
            <p>{t('transcriptFilesEmpty')}</p>
          ) : (
            categories.map((section) =>
              section.files.length > 0 ? (
                <section key={section.category} className="transcript-files-section">
                  <h3>{t(section.labelKey)}</h3>
                  <ul className="transcript-files-list">
                    {section.files.map((file) => (
                      <li key={`${section.category}-${file.id || file.name}`}>{file.name}</li>
                    ))}
                  </ul>
                </section>
              ) : null,
            )
          )}
          <p className="transcript-files-note">{t('transcriptFilesMetadataNote')}</p>
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
