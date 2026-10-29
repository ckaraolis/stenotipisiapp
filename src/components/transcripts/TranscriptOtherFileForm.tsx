import { useRef, useState, type FormEvent } from 'react';
import { addTranscriptOtherFile, updateTranscriptFile } from '../../api/transcriptFiles';
import { formatTranscriptFileSize, readFileAsBase64 } from '../../config/transcriptFiles';
import type { TranscriptFileListItem } from '../../types/transcript';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import TranscriptFileHistoryDialog from './TranscriptFileHistoryDialog';
import '../../styles/profile.css';
import '../../styles/workflow-wizard.css';

interface TranscriptOtherFileFormProps {
  mode: 'create' | 'edit';
  transcriptId: string;
  file?: TranscriptFileListItem;
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

export default function TranscriptOtherFileForm({
  mode,
  transcriptId,
  file,
  onCancel,
  onSaved,
}: TranscriptOtherFileFormProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(file?.description ?? '');
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

    if (!description.trim()) {
      setError(t('transcriptFileDescriptionRequired'));
      return;
    }

    if (mode === 'create' && !selectedFile) {
      setError(t('transcriptFileContentRequired'));
      return;
    }

    if (mode === 'edit' && !selectedFile && description.trim() === (file?.description ?? '')) {
      setError(t('transcriptFileNoChanges'));
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        if (!selectedFile) return;
        const contentBase64 = await readFileAsBase64(selectedFile);
        const result = await addTranscriptOtherFile(transcriptId, {
          name: selectedFile.name,
          type: selectedFile.type || 'application/octet-stream',
          contentBase64,
          description: description.trim(),
        });
        const message = result.messages.map((key) => t(key as TranslationKey)).join(' ');
        onSaved(message || t('transcriptFileAddedSuccess'));
        return;
      }

      if (!file) return;
      const payload = {
        slot: file.slot,
        fileId: file.fileId,
        name: selectedFile?.name ?? file.name,
        type: selectedFile?.type || 'application/octet-stream',
        description: description.trim(),
        contentBase64: '',
      };
      if (selectedFile) {
        payload.contentBase64 = await readFileAsBase64(selectedFile);
      }
      const result = await updateTranscriptFile(transcriptId, payload);
      const message = result.messages.map((key) => t(key as TranslationKey)).join(' ');
      onSaved(message || t('transcriptFileUpdatedSuccess'));
    } catch (err) {
      setError(parseApiErrors((err as Error).message, t));
    } finally {
      setSaving(false);
    }
  };

  const currentName = selectedFile?.name ?? file?.name ?? '';
  const currentSize = selectedFile?.size ?? file?.size ?? 0;

  return (
    <>
      <div className="user-details-form">
        <div className="profile-card">
          <form className="profile-form" onSubmit={handleSubmit} noValidate>
          <div className="user-details-header">
            <h2>
              {mode === 'create'
                ? t('transcriptOtherFileAddTitle')
                : t('transcriptOtherFileEditTitle')}
            </h2>
          </div>

          {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

          <div className="profile-grid">
            <label className="profile-label" htmlFor="other-file-description">
              {t('fileDescription')} *
            </label>
            <input
              id="other-file-description"
              type="text"
              className="profile-input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />

            <label className="profile-label">{t('fileName')}</label>
            <div>
              <input
                type="text"
                className="profile-input"
                value={currentName || t('noFileSelected')}
                readOnly
              />
              <div className="workflow-wizard-file-actions">
                <input ref={inputRef} type="file" hidden onChange={handleFileChange} />
                <button type="button" className="btn-secondary" onClick={handleBrowse}>
                  {t('browse')}
                </button>
              </div>
            </div>

            {currentName ? (
              <>
                <label className="profile-label">{t('fileSize')}</label>
                <input
                  type="text"
                  className="profile-input"
                  value={formatTranscriptFileSize(currentSize)}
                  readOnly
                />
              </>
            ) : null}

            {mode === 'edit' && file && file.historyCount > 0 ? (
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

      {showHistory && file ? (
        <TranscriptFileHistoryDialog
          transcriptId={transcriptId}
          file={file}
          onClose={() => setShowHistory(false)}
        />
      ) : null}
    </>
  );
}
