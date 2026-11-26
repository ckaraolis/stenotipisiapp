import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { importBonusConfigurationRows } from '../../api/stenotypistBonus';
import { downloadBonusConfigurationsImportTemplate } from '../../config/stenotypistBonusImport';
import type {
  StenotypistBonusImportResult,
  StenotypistBonusImportRow,
} from '../../types/stenotypistBonus';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/projects.css';

interface ImportBonusConfigurationsDialogProps {
  onClose: () => void;
  onImported: (summary: StenotypistBonusImportResult) => void;
}

function parseImportError(message: string, t: (key: TranslationKey) => string): string {
  try {
    const parsed = JSON.parse(message) as { errors?: string[] };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return parsed.errors.map((key) => t(key as TranslationKey)).join(' ');
    }
  } catch {
    // ignore
  }
  return t('bonusConfigurationImportError');
}

export default function ImportBonusConfigurationsDialog({
  onClose,
  onImported,
}: ImportBonusConfigurationsDialogProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<StenotypistBonusImportRow[]>([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const handleFileChange = async (file: File | null) => {
    setError('');
    setRows([]);
    setFileName('');
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setError(t('bonusConfigurationImportEmptyFile'));
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const parsed = XLSX.utils.sheet_to_json<StenotypistBonusImportRow>(sheet, {
        defval: '',
        raw: false,
        dateNF: 'dd/mm/yyyy',
      });
      if (parsed.length === 0) {
        setError(t('bonusConfigurationImportEmptyFile'));
        return;
      }
      const normalizedRows = parsed.map((row) => {
        const next: StenotypistBonusImportRow = {};
        for (const [key, value] of Object.entries(row)) {
          const cleanKey = key.replace(/^\uFEFF/, '').trim();
          next[cleanKey] = value;
        }
        return next;
      });
      setFileName(file.name);
      setRows(normalizedRows);
    } catch {
      setError(t('bonusConfigurationImportParseError'));
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      setError(t('bonusConfigurationImportEmptyFile'));
      return;
    }
    setImporting(true);
    setError('');
    try {
      const summary = await importBonusConfigurationRows(rows);
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
        aria-labelledby="bonus-configuration-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="bonus-configuration-import-title">{t('importBonusConfigurationsTitle')}</h2>
        <p className="profile-field-hint">{t('importBonusConfigurationsHint')}</p>

        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

        <div className="customer-import-actions">
          <button
            type="button"
            className="profile-cancel-btn"
            onClick={downloadBonusConfigurationsImportTemplate}
          >
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
            {t('bonusConfigurationImportRowsReady').replace('{count}', String(rows.length))}
          </p>
        ) : null}

        <div className="profile-actions">
          <button
            type="button"
            className="profile-cancel-btn"
            onClick={onClose}
            disabled={importing}
          >
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
