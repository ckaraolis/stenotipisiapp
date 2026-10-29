/** Job Matrix constants (§4.9). */
export const JOB_MATRIX_WIDTH_PX = 950;
export const JOB_MATRIX_HEIGHT_PX = 600;

/** Schedule panel column widths (§4.9.2.5). */
export const SCHEDULE_WEEKDAY_COLUMN_WIDTH_PX = 100;
export const SCHEDULE_WEEKEND_COLUMN_WIDTH_PX = 60;
export const SCHEDULE_PANEL_MIN_WIDTH_PX =
  SCHEDULE_WEEKDAY_COLUMN_WIDTH_PX * 5 + SCHEDULE_WEEKEND_COLUMN_WIDTH_PX * 2;

export const JOB_MATRIX_UNASSIGNED_PANEL_WIDTH_PX = 220;
export const JOB_MATRIX_STENOTYPIST_PANEL_WIDTH_PX = 240;

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
