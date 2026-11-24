import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { importProjectTypeRows } from '../../api/projectTypes';
import type { ProjectTypeImportResult, ProjectTypeImportRow } from '../../types/projectType';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/projects.css';

interface ImportProjectTypesDialogProps {
  onClose: () => void;
  onImported: (summary: ProjectTypeImportResult) => void;
}

const TEMPLATE_HEADERS = ['Customer', 'Type', 'Alias', 'Transcript Text', 'Status'];

function parseImportError(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('projectTypeImportError');
}

export default function ImportProjectTypesDialog({
  onClose,
  onImported,
}: ImportProjectTypesDialogProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ProjectTypeImportRow[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ['CRI Group Ltd', 'Συνεδρία', 'Συν', '', 'Enabled'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project Types');
    XLSX.writeFile(workbook, 'project-types-import-template.xlsx');
  };

  const handleFileChange = async (file: File | null) => {
    setError('');
    setRows([]);
    setFileName('');
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setError(t('projectTypeImportEmptyFile'));
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const parsed = XLSX.utils.sheet_to_json<ProjectTypeImportRow>(sheet, {
        defval: '',
        raw: false,
      });
      if (parsed.length === 0) {
        setError(t('projectTypeImportEmptyFile'));
        return;
      }
      setFileName(file.name);
      setRows(parsed);
    } catch {
      setError(t('projectTypeImportParseError'));
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      setError(t('projectTypeImportEmptyFile'));
      return;
    }
    setImporting(true);
    setError('');
    try {
      const summary = await importProjectTypeRows(rows);
      onImported(summary);
    } catch (err) {
      setError(parseImportError((err as Error).message, t));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-card customer-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-type-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="project-type-import-title">{t('importProjectTypesTitle')}</h2>
        <p className="profile-field-hint">{t('importProjectTypesHint')}</p>

        {error && <div className="profile-alert profile-alert-error">{error}</div>}

        <div className="customer-import-actions">
          <button type="button" className="profile-cancel-btn" onClick={handleDownloadTemplate}>
            {t('downloadImportTemplate')}
          </button>
          <button type="button" className="btn-primary" onClick={() => inputRef.current?.click()}>
            {t('chooseExcelFile')}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(event) => {
              void handleFileChange(event.target.files?.[0] ?? null);
              event.target.value = '';
            }}
          />
        </div>

        {fileName ? (
          <p className="customer-import-file">
            {fileName} — {t('projectTypeImportRowsReady').replace('{count}', String(rows.length))}
          </p>
        ) : null}

        <div className="profile-actions">
          <button type="button" className="profile-cancel-btn" onClick={onClose} disabled={importing}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="profile-submit"
            onClick={() => void handleImport()}
            disabled={importing || rows.length === 0}
          >
            {importing ? t('importing') : t('importFromExcel')}
          </button>
        </div>
      </div>
    </div>
  );
}
