import { useRef, useState, type FormEvent } from 'react';
import { updateTranscriptFile } from '../../api/transcriptFiles';
import {
  formatTranscriptFileSize,
  getTranscriptFileDescription,
  readFileAsBase64,
} from '../../config/transcriptFiles';
import type { TranscriptFileListItem } from '../../types/transcript';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import TranscriptFileHistoryDialog from './TranscriptFileHistoryDialog';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';

interface TranscriptStandardFileFormProps {
  transcriptId: string;
  file: TranscriptFileListItem;
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
  return t('transcriptFileSaveError');
}

export default function TranscriptStandardFileForm({
  transcriptId,
  file,
  onCancel,
  onSaved,
}: TranscriptStandardFileFormProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleBrowse = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = '';
    setSelectedFile(nextFile);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!selectedFile) {
      setError(t('transcriptFileContentRequired'));
      return;
    }

    setSaving(true);
    try {
      const contentBase64 = await readFileAsBase64(selectedFile);
      const result = await updateTranscriptFile(transcriptId, {
        slot: file.slot,
        fileId: file.fileId,
        name: selectedFile.name,
        type: selectedFile.type || 'application/octet-stream',
        contentBase64,
      });
      const message = result.messages.map((key) => t(key as TranslationKey)).join(' ');
      onSaved(message || t('transcriptFileUpdatedSuccess'));
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const currentName = selectedFile?.name ?? file.name;
  const currentSize = selectedFile?.size ?? file.size;

  return (
    <>
      <div className="user-details-form">
        <div className="profile-card">
          <form className="profile-form" onSubmit={handleSubmit} noValidate>
            <div className="user-details-header">
              <h2>{t('transcriptStandardFileEditTitle')}</h2>
            </div>

            {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

            <div className="profile-grid">
              <label className="profile-label">{t('fileDescription')}</label>
              <input
                type="text"
                className="profile-input"
                value={getTranscriptFileDescription(file, t)}
                readOnly
              />

              <label className="profile-label">{t('fileName')}</label>
              <div>
                <input type="text" className="profile-input" value={currentName} readOnly />
                <div className="workflow-wizard-file-actions">
                  <input ref={inputRef} type="file" hidden onChange={handleFileChange} />
                  <button type="button" className="btn-secondary" onClick={handleBrowse}>
                    {t('browse')}
                  </button>
                </div>
              </div>

              <label className="profile-label">{t('fileSize')}</label>
              <input
                type="text"
                className="profile-input"
                value={formatTranscriptFileSize(currentSize)}
                readOnly
              />

              {file.historyCount > 0 ? (
                <>
                  <label className="profile-label">{t('transcriptFileHistory')}</label>
                  <button type="button" className="btn-secondary" onClick={() => setShowHistory(true)}>
                    {t('transcriptFileViewHistory').replace('{count}', String(file.historyCount))}
                  </button>
                </>
              ) : null}
            </div>

            <div className="profile-actions">
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

      {showHistory ? (
        <TranscriptFileHistoryDialog
          transcriptId={transcriptId}
          file={file}
          onClose={() => setShowHistory(false)}
        />
      ) : null}
    </>
  );
}
