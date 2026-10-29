import {
  ensureCollectionFile,
  readCollection,
  writeCollection,
  collectionExists,
  DB_DIR,
} from './collectionStore.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { findUserById } from './db.js';
import { deliverEmailNotification } from './emailDelivery.js';
import { deliverSmsNotification } from './smsDelivery.js';
import {
  buildAppActionUrl,
  resolveNotificationChannels,
} from './notificationChannels.js';
import { resolveEmailSubject } from './emailSubjects.js';

const NOTIFICATIONS_PATH = path.join(__dirname, '..', 'database', 'notifications.json');

function readNotificationsFile() {
  ensureCollectionFile('notifications', { notifications: [] });
  return readCollection('notifications', { notifications: [] });
}

function writeNotificationsFile(data) {
  writeCollection('notifications', data);
}

function toPublicNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    message: notification.message,
    targetUserId: notification.targetUserId ?? null,
    createdByUserId: notification.createdByUserId ?? null,
    createdAt: notification.createdAt,
    read: notification.read === true,
    channels: Array.isArray(notification.channels) ? notification.channels : ['online'],
    actionUrl: notification.actionUrl ?? '',
    entityType: notification.entityType ?? '',
    entityId: notification.entityId ?? '',
  };
}

/** Persist an Online Notification record. */
export function createNotification({
  type,
  message,
  targetUserId,
  createdByUserId,
  actionUrl = '',
  entityType = '',
  entityId = '',
  channels = ['online'],
} = {}) {
  const data = readNotificationsFile();
  const notification = {
    id: `ntf-${crypto.randomUUID()}`,
    type: typeof type === 'string' ? type.trim() : '',
    message: typeof message === 'string' ? message.trim() : '',
    targetUserId: targetUserId ?? null,
    createdByUserId: createdByUserId ?? null,
    createdAt: new Date().toISOString(),
    read: false,
    channels: Array.isArray(channels) ? channels.filter(Boolean) : ['online'],
    actionUrl: typeof actionUrl === 'string' ? actionUrl.trim() : '',
    entityType: typeof entityType === 'string' ? entityType.trim() : '',
    entityId: typeof entityId === 'string' ? entityId.trim() : '',
  };
  data.notifications.unshift(notification);
  writeNotificationsFile(data);
  return toPublicNotification(notification);
}

/**
 * Dispatch a notification across Email / SMS / Online channels per Notification Types rules.
 * - Scheduling stenotypist events → SMS + Online
 * - Expedite / task events → Email + Online (with action URL when provided)
 * - Default → Online only
 *
 * Emails are sent to the Email Address defined on the relevant User (§1.1.1).
 */
export async function dispatchNotification({
  type,
  message,
  targetUserId = null,
  createdByUserId = null,
  actionUrl = '',
  actionPath = '',
  entityType = '',
  entityId = '',
  channels = null,
  emailSubject = '',
  emailTo = '',
  emailSender = null,
  emailSenderKey = '',
  emailDetails = [],
  emailInstructions = '',
  smsTo = '',
} = {}) {
  const resolvedChannels = Array.isArray(channels) && channels.length > 0
    ? channels
    : resolveNotificationChannels(type);

  const resolvedActionUrl =
    (typeof actionUrl === 'string' && actionUrl.trim()) ||
    (typeof actionPath === 'string' && actionPath.trim()
      ? buildAppActionUrl(actionPath.trim())
      : '');

  const targetUser = targetUserId ? findUserById(targetUserId) : null;
  const delivery = {
    channels: resolvedChannels,
    online: null,
    email: null,
    sms: null,
  };

  if (resolvedChannels.includes('online')) {
    delivery.online = createNotification({
      type,
      message,
      targetUserId,
      createdByUserId,
      actionUrl: resolvedActionUrl,
      entityType,
      entityId,
      channels: resolvedChannels,
    });
  }

  if (resolvedChannels.includes('email')) {
    const to =
      (typeof emailTo === 'string' && emailTo.trim()) ||
      targetUser?.email ||
      '';
    delivery.email = await deliverEmailNotification({
      to,
      subject: resolveEmailSubject(type, emailSubject),
      message,
      actionUrl: resolvedActionUrl,
      sender: emailSender,
      senderKey: emailSenderKey,
      messageType: type,
      details: emailDetails,
      instructions: emailInstructions,
      recipientName: targetUser?.fullName || '',
    });
  }

  if (resolvedChannels.includes('sms')) {
    const to =
      (typeof smsTo === 'string' && smsTo.trim()) ||
      targetUser?.mobilePhone ||
      '';
    delivery.sms = deliverSmsNotification({
      to,
      message,
    });
  }

  return delivery;
}

/** Fire-and-forget wrapper for sync call sites (scheduling/transcript hooks). */
export function queueNotification(options = {}) {
  return dispatchNotification(options).catch((error) => {
    console.error('Failed to dispatch notification:', error);
    return null;
  });
}

export function listNotifications({ targetUserId = '', unreadOnly = false } = {}) {
  const userId = typeof targetUserId === 'string' ? targetUserId.trim() : '';
  let rows = (readNotificationsFile().notifications ?? []).map(toPublicNotification);

  if (userId) {
    rows = rows.filter((row) => row.targetUserId === userId);
  }
  if (unreadOnly) {
    rows = rows.filter((row) => !row.read);
  }

  return rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export function listNotificationsForActor(actor, { unreadOnly = false } = {}) {
  if (!actor?.id) {
    return { errors: ['forbidden'] };
  }
  const notifications = listNotifications({
    targetUserId: actor.id,
    unreadOnly: unreadOnly === true,
  });
  return {
    notifications,
    unreadCount: notifications.filter((row) => !row.read).length,
  };
}

export function markNotificationRead(notificationId, actor) {
  if (!actor?.id) {
    return { errors: ['forbidden'] };
  }
  const data = readNotificationsFile();
  const index = (data.notifications ?? []).findIndex((row) => row.id === notificationId);
  if (index === -1) {
    return { errors: ['notificationNotFound'] };
  }
  const row = data.notifications[index];
  if (row.targetUserId && row.targetUserId !== actor.id) {
    return { errors: ['forbidden'] };
  }
  data.notifications[index] = { ...row, read: true };
  writeNotificationsFile(data);
  return { notification: toPublicNotification(data.notifications[index]) };
}

export function markAllNotificationsRead(actor) {
  if (!actor?.id) {
    return { errors: ['forbidden'] };
  }
  const data = readNotificationsFile();
  let updated = 0;
  data.notifications = (data.notifications ?? []).map((row) => {
    if (row.targetUserId === actor.id && row.read !== true) {
      updated += 1;
      return { ...row, read: true };
    }
    return row;
  });
  writeNotificationsFile(data);
  return { updated };
}
