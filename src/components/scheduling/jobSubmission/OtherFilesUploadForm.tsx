import { useRef } from 'react';
import type { JobSubmissionOtherFileEntry } from '../../../types/jobSubmission';
import { useLanguage } from '../../../i18n/LanguageContext';
import '../../../styles/profile.css';
import '../../../styles/workflow-wizard.css';

interface OtherFilesUploadFormProps {
  otherFiles: JobSubmissionOtherFileEntry[];
  onChange: (otherFiles: JobSubmissionOtherFileEntry[]) => void;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function createFileEntry(file: File): JobSubmissionOtherFileEntry {
  return {
    id: `file-${crypto.randomUUID().slice(0, 8)}`,
    name: file.name,
    description: '',
    size: file.size,
    type: file.type || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
  };
}

export default function OtherFilesUploadForm({ otherFiles, onChange }: OtherFilesUploadFormProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddNew = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    onChange([...otherFiles, createFileEntry(file)]);
  };

  const handleDescriptionChange = (fileId: string, description: string) => {
    onChange(
      otherFiles.map((file) => (file.id === fileId ? { ...file, description } : file)),
    );
  };

  const handleClearFile = (fileId: string) => {
    onChange(otherFiles.filter((file) => file.id !== fileId));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="profile-form">
      <h3 className="workflow-wizard-step-title">{t('jobSubmissionStepOtherFiles')}</h3>
      <p className="workflow-wizard-step-description">{t('jobSubmissionStepOtherFilesDescription')}</p>

      <div className="workflow-wizard-file-actions">
        <input ref={inputRef} type="file" hidden onChange={handleFileChange} />
        <button type="button" className="btn-secondary" onClick={handleAddNew}>
          {t('addNew')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleClearAll}
          disabled={otherFiles.length === 0}
        >
          {t('clearAll')}
        </button>
      </div>

      {otherFiles.length === 0 ? (
        <p className="profile-field-hint">{t('noFilesSelected')}</p>
      ) : (
        <table className="workflow-wizard-file-list">
          <thead>
            <tr>
              <th>{t('fileName')}</th>
              <th>{t('fileDescription')}</th>
              <th>{t('fileSize')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {otherFiles.map((file) => (
              <tr key={file.id}>
                <td>{file.name}</td>
                <td>
                  <input
                    type="text"
                    className="profile-input"
                    value={file.description}
                    placeholder={t('fileDescription')}
                    onChange={(event) =>
                      handleDescriptionChange(file.id, event.target.value)
                    }
                  />
                </td>
                <td>{formatFileSize(file.size)}</td>
                <td>
                  <button type="button" onClick={() => handleClearFile(file.id)}>
                    {t('clear')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
