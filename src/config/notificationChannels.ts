import type { TranslationKey } from '../i18n/translations';
import type { NotificationChannel } from '../types/notifications';
import { NOTIFICATION_CHANNELS } from '../types/notifications';

export { NOTIFICATION_CHANNELS };
export type { NotificationChannel };

export function notificationChannelLabelKey(channel: string): TranslationKey {
  switch (channel) {
    case 'email':
      return 'notificationChannel_email';
    case 'sms':
      return 'notificationChannel_sms';
    case 'online':
      return 'notificationChannel_online';
    default:
      return 'notificationChannel_unknown';
  }
}

export function formatNotificationTimestamp(value: string, language: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'el' ? 'el-GR' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}
