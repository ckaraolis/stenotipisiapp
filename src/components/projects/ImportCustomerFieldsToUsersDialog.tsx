import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { importCustomerFieldUserRows } from '../../api/customerFieldsToUsers';
import type {
  CustomerFieldUserImportResult,
  CustomerFieldUserImportRow,
} from '../../types/customerFieldUser';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/projects.css';

interface ImportCustomerFieldsToUsersDialogProps {
  onClose: () => void;
  onImported: (summary: CustomerFieldUserImportResult) => void;
}

const TEMPLATE_HEADERS = ['Customer', 'Field Name', 'Field Value', 'Users', 'Validity From'];

function parseImportError(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('customerFieldUserImportError');
}

export default function ImportCustomerFieldsToUsersDialog({
  onClose,
  onImported,
}: ImportCustomerFieldsToUsersDialogProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CustomerFieldUserImportRow[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ['CRI Group Ltd', 'Δικαστής', 'Μάριος Κοφτερός', 'MAK', '16/09/2019'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Fields');
    XLSX.writeFile(workbook, 'customer-fields-to-users-import-template.xlsx');
  };

  const handleFileChange = async (file: File | null) => {
    setError('');
    setRows([]);
    setFileName('');
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      // cellDates:false + dateNF keeps Excel calendar days as DD/MM/YYYY (avoids TZ shifts).
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setError(t('customerFieldUserImportEmptyFile'));
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const parsed = XLSX.utils.sheet_to_json<CustomerFieldUserImportRow>(sheet, {
        defval: '',
        raw: false,
        dateNF: 'dd/mm/yyyy',
      });
      if (parsed.length === 0) {
        setError(t('customerFieldUserImportEmptyFile'));
        return;
      }
      setFileName(file.name);
      setRows(parsed);
    } catch {
      setError(t('customerFieldUserImportParseError'));
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      setError(t('customerFieldUserImportEmptyFile'));
      return;
    }
    setImporting(true);
    setError('');
    try {
      const summary = await importCustomerFieldUserRows(rows);
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
        aria-labelledby="customer-field-user-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="customer-field-user-import-title">{t('importCustomerFieldsToUsersTitle')}</h2>
        <p className="profile-field-hint">{t('importCustomerFieldsToUsersHint')}</p>

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
            {fileName} —{' '}
            {t('customerFieldUserImportRowsReady').replace('{count}', String(rows.length))}
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
