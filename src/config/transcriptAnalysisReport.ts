import type { TranscriptAnalysisRow } from '../types/transcript';

const CSV_COLUMNS: Array<{ key: keyof TranscriptAnalysisRow; header: string }> = [
  { key: 'jobNumber', header: 'Job Number' },
  { key: 'jobStatus', header: 'Status' },
  { key: 'customerName', header: 'Customer' },
  { key: 'projectNumber', header: 'Project' },
  { key: 'date', header: 'Date' },
  { key: 'time', header: 'Time' },
  { key: 'stenotypistAlias', header: 'Stenotypist Alias' },
  { key: 'stenotypistName', header: 'Stenotypist' },
  { key: 'editorName', header: 'Editor' },
  { key: 'reviewerName', header: 'Reviewer' },
  { key: 'publisherName', header: 'Publisher' },
  { key: 'expedite', header: 'Expedite' },
  { key: 'bypassApproval', header: 'Bypass Approval' },
  { key: 'jobEndTime', header: 'Job End Time' },
  { key: 'serviceLevelAgreement', header: 'SLA' },
  { key: 'deadlineLabel', header: 'Deadline' },
  { key: 'eteMinutes', header: 'ETE (minutes)' },
  { key: 'editDurationLabel', header: 'Edit Duration' },
  { key: 'transcriptOwners', header: 'Transcript Owners' },
  { key: 'pages', header: 'Pages' },
  { key: 'billedHours', header: 'Billed Hours' },
  { key: 'stenotypingHours', header: 'Stenotyping Hours' },
  { key: 'billedStenotypingLabel', header: 'Billed / Stenotyping Hours' },
  { key: 'editingHours', header: 'Editing Hours' },
  { key: 'editingHoursPerPage', header: 'Editing Hours Per Page' },
  { key: 'editingHoursPerBilledHour', header: 'Editing Hours Per Billed Hour' },
  { key: 'reviewingHours', header: 'Reviewing Hours' },
  { key: 'reviewingHoursPerPage', header: 'Reviewing Hours Per Page' },
  { key: 'reviewingHoursPerBilledHour', header: 'Reviewing Hours Per Billed Hour' },
  { key: 'accuracyPercent', header: 'Accuracy %' },
  { key: 'monthStenotypistBilledLabel', header: 'Month Stenotypist / Billed Hours' },
  { key: 'monthPagesBilledLabel', header: 'Month Pages / Billed Hours' },
];

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildTranscriptsAnalysisCsv(rows: TranscriptAnalysisRow[]): string {
  const header = CSV_COLUMNS.map((column) => escapeCsvValue(column.header)).join(',');
  const body = rows.map((row) =>
    CSV_COLUMNS.map((column) => escapeCsvValue(row[column.key])).join(','),
  );
  return [header, ...body].join('\r\n');
}

export function downloadTranscriptsAnalysisCsv(rows: TranscriptAnalysisRow[], fileName: string): void {
  const csv = buildTranscriptsAnalysisCsv(rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
