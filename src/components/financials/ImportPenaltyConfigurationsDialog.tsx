import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { importPenaltyConfigurationRows } from '../../api/stenotypistPenalty';
import { downloadPenaltyConfigurationsImportTemplate } from '../../config/stenotypistPenaltyImport';
import type {
  StenotypistPenaltyImportResult,
  StenotypistPenaltyImportRow,
} from '../../types/stenotypistPenalty';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import '../../styles/profile.css';
import '../../styles/projects.css';

interface ImportPenaltyConfigurationsDialogProps {
  onClose: () => void;
  onImported: (summary: StenotypistPenaltyImportResult) => void;
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
  return t('penaltyConfigurationImportError');
}

export default function ImportPenaltyConfigurationsDialog({
  onClose,
  onImported,
}: ImportPenaltyConfigurationsDialogProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<StenotypistPenaltyImportRow[]>([]);
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
        setError(t('penaltyConfigurationImportEmptyFile'));
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const parsed = XLSX.utils.sheet_to_json<StenotypistPenaltyImportRow>(sheet, {
        defval: '',
        raw: false,
        dateNF: 'dd/mm/yyyy',
      });
      if (parsed.length === 0) {
        setError(t('penaltyConfigurationImportEmptyFile'));
        return;
      }
      const normalizedRows = parsed.map((row) => {
        const next: StenotypistPenaltyImportRow = {};
        for (const [key, value] of Object.entries(row)) {
          const cleanKey = key.replace(/^\uFEFF/, '').trim();
          next[cleanKey] = value;
        }
        return next;
      });
      setFileName(file.name);
      setRows(normalizedRows);
    } catch {
      setError(t('penaltyConfigurationImportParseError'));
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      setError(t('penaltyConfigurationImportEmptyFile'));
      return;
    }
    setImporting(true);
    setError('');
    try {
      const summary = await importPenaltyConfigurationRows(rows);
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
        aria-labelledby="penalty-configuration-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="penalty-configuration-import-title">{t('importPenaltyConfigurationsTitle')}</h2>
        <p className="profile-field-hint">{t('importPenaltyConfigurationsHint')}</p>

        {error ? <div className="profile-alert profile-alert-error">{error}</div> : null}

        <div className="customer-import-actions">
          <button
            type="button"
            className="profile-cancel-btn"
            onClick={downloadPenaltyConfigurationsImportTemplate}
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
            {t('penaltyConfigurationImportRowsReady').replace('{count}', String(rows.length))}
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
