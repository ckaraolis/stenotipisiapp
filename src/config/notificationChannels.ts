import type { TranslationKey } from '../i18n/translations';
import type { NotificationChannel } from '../types/notifications';
import { NOTIFICATION_CHANNELS } from '../types/notifications';
import { formatDateTimeDisplay } from '../utils/dateFormat';

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

export function formatNotificationTimestamp(value: string, _language?: string): string {
  return formatDateTimeDisplay(value);
}
