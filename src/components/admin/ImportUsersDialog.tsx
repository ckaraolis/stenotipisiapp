import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { importUserRows, type UserImportResult, type UserImportRow } from '../../api/profile';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/projects.css';

interface ImportUsersDialogProps {
  onClose: () => void;
  onImported: (summary: UserImportResult) => void;
}

const TEMPLATE_HEADERS = [
  'Username',
  'Full Name',
  'Email',
  'Roles',
  'Status',
  'Customer',
  'Contact Phone',
  'Mobile Phone',
  'Language',
];

function parseImportError(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('userImportError');
}

export default function ImportUsersDialog({ onClose, onImported }: ImportUsersDialogProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<UserImportRow[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ['ΜΑΚ', 'Μάριος Κοφτερός', '', 'stenotypist', 'Active', '', '', '', 'el'],
      ['ΤΑΛΑ', 'Ν. Ταλαρίδου', '', 'stenotypist', 'Active', '', '', '', 'el'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    XLSX.writeFile(workbook, 'users-import-template.xlsx');
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
        setError(t('userImportEmptyFile'));
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const parsed = XLSX.utils.sheet_to_json<UserImportRow>(sheet, {
        defval: '',
        raw: false,
      });
      if (parsed.length === 0) {
        setError(t('userImportEmptyFile'));
        return;
      }
      setFileName(file.name);
      setRows(parsed);
    } catch {
      setError(t('userImportParseError'));
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      setError(t('userImportEmptyFile'));
      return;
    }
    setImporting(true);
    setError('');
    try {
      const summary = await importUserRows(rows);
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
        aria-labelledby="user-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="user-import-title">{t('importUsersTitle')}</h2>
        <p className="profile-field-hint">{t('importUsersHint')}</p>

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
            {fileName} — {t('userImportRowsReady').replace('{count}', String(rows.length))}
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
