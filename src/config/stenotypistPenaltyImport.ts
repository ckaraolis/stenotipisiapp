import * as XLSX from 'xlsx';

export const PENALTY_CONFIGURATION_IMPORT_TEMPLATE_HEADERS = [
  'Stenotypist',
  'Target Hours Before Deadline',
  'Penalty Per Hour Late',
  'Validity From',
] as const;

export function downloadPenaltyConfigurationsImportTemplate(): void {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...PENALTY_CONFIGURATION_IMPORT_TEMPLATE_HEADERS],
    ['Αδελίνα Πετρόβα', '1', '10.00', '01/02/2026'],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Penalty Configurations');
  XLSX.writeFile(workbook, 'penalty-configurations-import-template.xlsx');
}
