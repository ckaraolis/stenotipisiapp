/** §3.2 — Travelling time between districts (minutes, validity-dated). */
export function formatDistrictLabel(record: {
  districtName?: string;
  districtAlias?: string;
  name?: string;
  alias?: string;
}): string {
  const districtName = record.districtName ?? record.name ?? '';
  const districtAlias = record.districtAlias ?? record.alias ?? '';
  if (districtAlias && districtName) {
    return `${districtAlias} – ${districtName}`;
  }
  return districtName || districtAlias || '—';
}

export function formatTravellingTimeRoute(record: {
  district1Name: string;
  district1Alias: string;
  district2Name: string;
  district2Alias: string;
}): string {
  return `${formatDistrictLabel({ districtName: record.district1Name, districtAlias: record.district1Alias })} → ${formatDistrictLabel({ districtName: record.district2Name, districtAlias: record.district2Alias })}`;
}
