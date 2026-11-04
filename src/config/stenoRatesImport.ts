import * as XLSX from 'xlsx';

export const STENO_RATES_IMPORT_TEMPLATE_HEADERS = [
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
] as const;

export function downloadStenoRatesImportTemplate(): void {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...STENO_RATES_IMPORT_TEMPLATE_HEADERS],
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
}
