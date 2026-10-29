/** §2.5 — SGXML duration values are divided by this constant to yield hours. */
export const SGXML_DURATION_SECONDS_PER_HOUR = 360;

function collectDurationSegments(xmlContent, scopePattern, minIndex = 0) {
  const scopeMatch = scopePattern ? xmlContent.match(scopePattern) : null;
  const scope = scopeMatch ? scopeMatch[1] : xmlContent;
  const segments = [];

  const durationTagPattern = /<Duration-(\d+)>([^<]*)<\/Duration-\1>/gi;
  let match = durationTagPattern.exec(scope);
  while (match) {
    const index = Number.parseInt(match[1], 10);
    if (index >= minIndex) {
      const seconds = Number.parseFloat(String(match[2]).trim());
      if (Number.isFinite(seconds) && seconds >= 0) {
        segments.push({ index, seconds });
      }
    }
    match = durationTagPattern.exec(scope);
  }

  const durationElementPattern = /<Duration\b([^>]*)>([^<]*)<\/Duration>/gi;
  match = durationElementPattern.exec(scope);
  while (match) {
    const attrs = match[1];
    const value = String(match[2]).trim();
    const indexMatch =
      attrs.match(/(?:name|id)=["']Duration-(\d+)["']/i) ??
      attrs.match(/index=["'](\d+)["']/i);
    if (!indexMatch) {
      match = durationElementPattern.exec(scope);
      continue;
    }
    const index = Number.parseInt(indexMatch[1], 10);
    if (index >= minIndex) {
      const seconds = Number.parseFloat(value);
      if (Number.isFinite(seconds) && seconds >= 0) {
        const existing = segments.find((segment) => segment.index === index);
        if (!existing) {
          segments.push({ index, seconds });
        }
      }
    }
    match = durationElementPattern.exec(scope);
  }

  segments.sort((a, b) => a.index - b.index);
  return segments;
}

/**
 * §2.1 — Parse edit duration from Finish'em .SGXML (Submit Edited Transcript Workflow).
 * Sums Duration-1, Duration-2, … under <Edit-Settings>; skips Duration-0.
 * Values are seconds; returned total is minutes.
 */
export function parseEditDurationFromSgxml(xmlContent) {
  if (typeof xmlContent !== 'string' || !xmlContent.trim()) {
    return { totalMinutes: 0, segments: [] };
  }

  const editSettingsPattern = /<Edit-Settings\b[^>]*>([\s\S]*?)<\/Edit-Settings>/i;
  const rawSegments = collectDurationSegments(xmlContent, editSettingsPattern, 1);
  const segments = rawSegments.map((segment) => ({
    ...segment,
    minutes: segment.seconds / 60,
  }));
  const totalMinutes = segments.reduce((total, segment) => total + segment.minutes, 0);

  return {
    totalMinutes: Math.round(totalMinutes * 10) / 10,
    segments,
  };
}

/** §2.5 — Tran-Settings Duration-0 cap for stenotyping verification (hours). */
export function parseTranDuration0HoursFromSgxml(xmlContent) {
  if (typeof xmlContent !== 'string' || !xmlContent.trim()) {
    return null;
  }

  const tranSettingsPattern = /<Tran-Settings\b[^>]*>([\s\S]*?)<\/Tran-Settings>/i;
  const segments = collectDurationSegments(xmlContent, tranSettingsPattern, 0);
  const duration0 = segments.find((segment) => segment.index === 0);
  if (!duration0) return null;

  return Math.round((duration0.seconds / SGXML_DURATION_SECONDS_PER_HOUR) * 100) / 100;
}

/** §2.5 — Editing hours from Edit-Settings Duration-1+ (seconds ÷ 360). */
export function parseEditingHoursFromSgxml(xmlContent) {
  if (typeof xmlContent !== 'string' || !xmlContent.trim()) {
    return { hours: 0, segments: [] };
  }

  const editSettingsPattern = /<Edit-Settings\b[^>]*>([\s\S]*?)<\/Edit-Settings>/i;
  const segments = collectDurationSegments(xmlContent, editSettingsPattern, 1).map((segment) => ({
    index: segment.index,
    seconds: segment.seconds,
    hours: segment.seconds / SGXML_DURATION_SECONDS_PER_HOUR,
  }));
  const hours = segments.reduce((total, segment) => total + segment.hours, 0);

  return {
    hours: Math.round(hours * 100) / 100,
    segments,
  };
}

/** §2.5 — Accuracy from Total-Strokes and Number-of-Untranslates attributes. */
export function parseAccuracyFromSgxml(xmlContent) {
  if (typeof xmlContent !== 'string' || !xmlContent.trim()) {
    return null;
  }

  const totalMatch = xmlContent.match(
    /<Total-Strokes\b[^>]*sgpref-val=["'](\d+)["']/i,
  );
  const untranslatesMatch = xmlContent.match(
    /<Number-of-Untranslates\b[^>]*sgpref-val=["'](\d+)["']/i,
  );
  if (!totalMatch) return null;

  const totalStrokes = Number.parseInt(totalMatch[1], 10);
  const untranslates = untranslatesMatch ? Number.parseInt(untranslatesMatch[1], 10) : 0;
  if (!Number.isFinite(totalStrokes) || totalStrokes <= 0) return null;
  if (!Number.isFinite(untranslates) || untranslates < 0) return null;

  const accuracy = ((totalStrokes - untranslates) / totalStrokes) * 100;
  return Math.round(accuracy * 100) / 100;
}
