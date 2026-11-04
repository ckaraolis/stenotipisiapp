import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { importStenoRateRows } from '../../api/stenoRates';
import type { StenoRateImportResult, StenoRateImportRow } from '../../types/stenoRates';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/projects.css';

interface ImportStenoRatesDialogProps {
  onClose: () => void;
  onImported: (summary: StenoRateImportResult) => void;
}

const TEMPLATE_HEADERS = [
  'Customer',
  'Hourly Rate',
  'Hourly Rate (Expedited)',
  'Hourly Rate (Outside Working Hrs)',
  'Hourly Rate (Outside Working Hrs & Expedited)',
  '1st Discount Percentage',
  'Nr Of Exempted Stenotypists',
  '2nd Discount Percentage',
  '2nd Stenotypist Discount Threshold',
  'Travel by Km Amount',
  'SLA',
  'SLA (Expedited)',
  'Working Hours Start',
  'Working Hours End',
  'Validity From',
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
  return t('stenoRateImportError');
}

export default function ImportStenoRatesDialog({ onClose, onImported }: ImportStenoRatesDialogProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<StenoRateImportRow[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      [
        'GCP AUDITORS LTD',
        '100',
        '100',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '1 day',
        '',
        '08:00',
        '17:00',
        '01/01/2024',
      ],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Steno Rates');
    XLSX.writeFile(workbook, 'steno-rates-import-template.xlsx');
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
        setError(t('stenoRateImportEmptyFile'));
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const parsed = XLSX.utils.sheet_to_json<StenoRateImportRow>(sheet, {
        defval: '',
        raw: false,
      });
      if (parsed.length === 0) {
        setError(t('stenoRateImportEmptyFile'));
        return;
      }
      setFileName(file.name);
      setRows(parsed);
    } catch {
      setError(t('stenoRateImportParseError'));
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      setError(t('stenoRateImportEmptyFile'));
      return;
    }
    setImporting(true);
    setError('');
    try {
      const summary = await importStenoRateRows(rows);
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
        aria-labelledby="steno-rate-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="steno-rate-import-title">{t('importStenoRatesTitle')}</h2>
        <p className="profile-field-hint">{t('importStenoRatesHint')}</p>

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
            {fileName} — {t('stenoRateImportRowsReady').replace('{count}', String(rows.length))}
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
