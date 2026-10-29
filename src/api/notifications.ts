import type { AppNotification, NotificationsListResponse } from '../types/notifications';
import { getAuthToken } from '../utils/auth';

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchNotifications(options: { unreadOnly?: boolean } = {}): Promise<NotificationsListResponse> {
  const params = new URLSearchParams();
  if (options.unreadOnly) params.set('unreadOnly', 'true');
  const query = params.toString();
  const response = await fetch(`/api/notifications${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error('notificationsLoadError');
  }
  return response.json() as Promise<NotificationsListResponse>;
}

export async function markNotificationAsRead(id: string): Promise<AppNotification> {
  const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error('notificationsMarkReadError');
  }
  return response.json() as Promise<AppNotification>;
}

export async function markAllNotificationsAsRead(): Promise<{ updated: number }> {
  const response = await fetch('/api/notifications/read-all', {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error('notificationsMarkReadError');
  }
  return response.json() as Promise<{ updated: number }>;
}
