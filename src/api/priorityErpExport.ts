import { getAuthToken } from '../utils/auth';

export async function downloadPriorityErpExport(
  exportId: string,
  format: 'csv' | 'json' = 'csv',
): Promise<void> {
  const token = getAuthToken();
  const response = await fetch(
    `/api/financials/priority-erp/exports/${exportId}/download?format=${format}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `astraea-priority-erp-${exportId}.${format}`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
