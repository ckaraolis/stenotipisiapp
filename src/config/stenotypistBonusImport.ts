import * as XLSX from 'xlsx';

/** Excel headers aligned with ASTRAEA (T1 / TF% / PPHF intentionally omitted). */
export const BONUS_CONFIGURATION_IMPORT_TEMPLATE_HEADERS = [
  'Stenotypist',
  'H1',
  'H2',
  'H1B€',
  'H2B€',
  'Validity From',
] as const;

export function downloadBonusConfigurationsImportTemplate(): void {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...BONUS_CONFIGURATION_IMPORT_TEMPLATE_HEADERS],
    ['Αδελίνα Πετρόβα', '52', '72', '18.00', '20.00', '01/11/2025'],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bonus Configurations');
  XLSX.writeFile(workbook, 'bonus-configurations-import-template.xlsx');
}
