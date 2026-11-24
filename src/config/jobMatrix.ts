/** Job Matrix constants (§4.9). */
export const JOB_MATRIX_WIDTH_PX = 950;
export const JOB_MATRIX_HEIGHT_PX = 600;

/** Schedule panel: seven equal day columns fill available width. */
export const SCHEDULE_WEEKDAY_COLUMN_WIDTH_PX = 100;
export const SCHEDULE_WEEKEND_COLUMN_WIDTH_PX = 100;
export const SCHEDULE_PANEL_MIN_WIDTH_PX = 0;

export const JOB_MATRIX_UNASSIGNED_PANEL_WIDTH_PX = 220;
export const JOB_MATRIX_STENOTYPIST_PANEL_WIDTH_PX = 520;

/** Client-defined characters per transcript page for M2. */
export const CHARACTERS_PER_PAGE_CONSTANT = 2000;

/** Client-defined minutes per transcript page for ETE (§2.4). */
export const TRANSCRIPT_ETE_MINUTES_PER_PAGE = 15;

/** §2.5 — Idle gap between timestamps ignored for stenotyping hours (seconds). */
export const TRANSCRIPT_STENOTYPING_IDLE_SECONDS = 60;

/** Gap between activity timestamps treated as inactivity for M6 (minutes). */
export const STENOTYPING_INACTIVITY_THRESHOLD_MINUTES = 15;

export const MATRIX_METRIC_KEYS = [
  'm1',
  'm2',
  'm3',
  'm4',
  'm5',
  'm6',
  'm7',
  'm8',
  'm9',
] as const;

export type MatrixMetricKey = (typeof MATRIX_METRIC_KEYS)[number];

/**
 * ASTRAEA stenotypist-list columns for the Job Matrix.
 * Values are sourced from computed m1–m9 metrics where a mapping exists.
 */
export const ALLOCATION_METRIC_COLUMNS = [
  { key: 'ly', labelKey: 'colLy', source: 'm1' },
  { key: 'py', labelKey: 'colPy', source: 'm2' },
  { key: 'pya', labelKey: 'colPya', source: null },
  { key: 'by', labelKey: 'colBy', source: 'm3' },
  { key: 'b14', labelKey: 'colB14', source: 'm4' },
  { key: 'bm', labelKey: 'colBm', source: 'm5' },
  { key: 'am', labelKey: 'colAm', source: 'm6' },
  { key: 'ctd', labelKey: 'colCtd', source: 'm8' },
  { key: 'pp', labelKey: 'colPp', source: 'm7' },
  { key: 'pch', labelKey: 'colPch', source: null },
  { key: 'pap', labelKey: 'colPap', source: null },
  { key: 'dl', labelKey: 'colDl', source: null },
  { key: 'ncd', labelKey: 'colNcd', source: null },
  { key: 'dla', labelKey: 'colDla', source: null },
  { key: 't14', labelKey: 'colT14', source: 'm9' },
] as const;

export type AllocationMetricColumnKey = (typeof ALLOCATION_METRIC_COLUMNS)[number]['key'];
