/**
 * § Notification Types — delivery channels.
 * - email / online: expedite access to the application and specific tasks
 * - sms: scheduling notifications for stenotypists (offline-aware)
 */
export const NOTIFICATION_CHANNELS = ['email', 'sms', 'online'];

/** Scheduling events that must reach stenotypists via SMS (+ online). */
export const SCHEDULING_SMS_EVENT_TYPES = new Set([
  'job_assigned',
  'job_unassigned',
  'job_rejected',
]);

/**
 * Task / access events that use Email + Online Notifications
 * so recipients can open the app and act quickly.
 */
export const EXPEDITE_EMAIL_ONLINE_EVENT_TYPES = new Set([
  'transcript_editor_assigned',
  'transcript_reviewer_assigned',
  'transcript_edited_submitted',
  'transcript_reviewed_submitted',
  'transcript_published',
  'transcript_published_bypass',
  'transcript_created',
  'password_reset',
  'password_changed',
  'account_email_changed_old',
  'account_email_changed_new',
  'stenotypist_leave_submitted',
  'stenotypist_leave_approved',
  'stenotypist_leave_rejected',
]);

export function isNotificationChannel(value) {
  return NOTIFICATION_CHANNELS.includes(value);
}

/**
 * Resolve delivery channels for an event type.
 * Callers may override with an explicit `channels` array.
 */
export function resolveNotificationChannels(eventType) {
  const type = typeof eventType === 'string' ? eventType.trim() : '';
  if (SCHEDULING_SMS_EVENT_TYPES.has(type)) {
    return ['sms', 'online'];
  }
  if (EXPEDITE_EMAIL_ONLINE_EVENT_TYPES.has(type)) {
    return ['email', 'online'];
  }
  return ['online'];
}

export function getAppPublicBaseUrl() {
  const fromEnv =
    typeof process.env.APP_PUBLIC_URL === 'string' ? process.env.APP_PUBLIC_URL.trim() : '';
  return (fromEnv || 'http://localhost:5173').replace(/\/$/, '');
}

export function buildAppActionUrl(pathname = '/') {
  const path = typeof pathname === 'string' && pathname.startsWith('/') ? pathname : `/${pathname || ''}`;
  return `${getAppPublicBaseUrl()}${path}`;
}
