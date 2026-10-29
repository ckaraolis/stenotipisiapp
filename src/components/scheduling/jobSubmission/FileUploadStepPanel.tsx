import { useRef } from 'react';
import type { JobSubmissionFileEntry } from '../../../types/jobSubmission';
import { useLanguage } from '../../../i18n/LanguageContext';

interface FileUploadStepPanelProps {
  title: string;
  description: string;
  files: JobSubmissionFileEntry[];
  onAddFiles: (files: JobSubmissionFileEntry[]) => void;
  onRemoveFile: (fileId: string) => void;
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUploadStepPanel({
  title,
  description,
  files,
  onAddFiles,
  onRemoveFile,
}: FileUploadStepPanelProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;

    const entries: JobSubmissionFileEntry[] = selected.map((file) => ({
      id: `file-${crypto.randomUUID().slice(0, 8)}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
    }));

    onAddFiles(entries);
    event.target.value = '';
  };

  return (
    <div>
      <h3 className="workflow-wizard-step-title">{title}</h3>
      <p className="workflow-wizard-step-description">{description}</p>

      <div className="workflow-wizard-file-actions">
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={handleFileChange}
        />
        <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()}>
          {t('browseFiles')}
        </button>
      </div>

      {files.length > 0 ? (
        <table className="workflow-wizard-file-list">
          <thead>
            <tr>
              <th>{t('fileName')}</th>
              <th>{t('fileSize')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td>{file.name}</td>
                <td>{formatFileSize(file.size)}</td>
                <td>
                  <button type="button" onClick={() => onRemoveFile(file.id)}>
                    {t('remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="profile-field-hint">{t('noFilesSelected')}</p>
      )}
    </div>
  );
}
