import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { importCustomerRows } from '../../api/customers';
import type { CustomerImportResult, CustomerImportRow } from '../../types/customer';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/projects.css';

interface ImportCustomersDialogProps {
  onClose: () => void;
  onImported: (summary: CustomerImportResult) => void;
}

const TEMPLATE_HEADERS = [
  'Name',
  'Alias',
  'Contact Person',
  'Contact Phone',
  'Contact Email',
  'Payment Terms',
  'Number In Priority ERP',
  'Status',
  'Remarks',
  'Steno Customer',
  'Audio Customer',
  'Captions Customer',
  'Hourly Rate',
  'SLA',
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
  return t('customerImportError');
}

export default function ImportCustomersDialog({ onClose, onImported }: ImportCustomersDialogProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CustomerImportRow[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      [
        'CRI Group Ltd',
        'CRI',
        'Sample Contact',
        '22123456',
        'contact@example.com',
        'Credit',
        'C016936',
        'Enabled',
        '',
        'Yes',
        '',
        '',
        '0',
        '1 day',
      ],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
    XLSX.writeFile(workbook, 'customers-import-template.xlsx');
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
        setError(t('customerImportEmptyFile'));
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const parsed = XLSX.utils.sheet_to_json<CustomerImportRow>(sheet, {
        defval: '',
        raw: false,
      });
      if (parsed.length === 0) {
        setError(t('customerImportEmptyFile'));
        return;
      }
      setFileName(file.name);
      setRows(parsed);
    } catch {
      setError(t('customerImportParseError'));
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      setError(t('customerImportEmptyFile'));
      return;
    }
    setImporting(true);
    setError('');
    try {
      const summary = await importCustomerRows(rows);
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
        aria-labelledby="customer-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="customer-import-title">{t('importCustomersTitle')}</h2>
        <p className="profile-field-hint">{t('importCustomersHint')}</p>

        {error && <div className="profile-alert profile-alert-error">{error}</div>}

        <div className="customer-import-actions">
          <button type="button" className="profile-cancel-btn" onClick={handleDownloadTemplate}>
            {t('downloadImportTemplate')}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => inputRef.current?.click()}
          >
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
            {fileName} — {t('customerImportRowsReady').replace('{count}', String(rows.length))}
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
