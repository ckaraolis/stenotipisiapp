export const NOTIFICATION_CHANNELS = ['email', 'sms', 'online'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  targetUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  read: boolean;
  channels: NotificationChannel[];
  actionUrl: string;
  entityType: string;
  entityId: string;
}

export interface NotificationsListResponse {
  notifications: AppNotification[];
  unreadCount: number;
}
