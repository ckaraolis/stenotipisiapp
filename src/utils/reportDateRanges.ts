export function formatReportDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getThisMonthDateRange(anchorDate: Date = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const year = anchorDate.getFullYear();
  const month = String(anchorDate.getMonth() + 1).padStart(2, '0');
  return {
    dateFrom: `${year}-${month}-01`,
    dateTo: formatReportDateKey(anchorDate),
  };
}
