import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../../api/notifications';
import {
  formatNotificationTimestamp,
  notificationChannelLabelKey,
} from '../../config/notificationChannels';
import { useLanguage } from '../../i18n/LanguageContext';
import type { AppNotification } from '../../types/notifications';
import '../../styles/notifications.css';

function toAppPath(actionUrl: string): string | null {
  if (!actionUrl) return null;
  try {
    if (actionUrl.startsWith('/')) return actionUrl;
    const url = new URL(actionUrl);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export default function NotificationsInbox() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchNotifications();
      setRows(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      setError(t('notificationsLoadError'));
      setRows([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMarkRead = async (row: AppNotification) => {
    if (row.read) return;
    setBusyId(row.id);
    try {
      await markNotificationAsRead(row.id);
      await load();
    } catch {
      setError(t('notificationsMarkReadError'));
    } finally {
      setBusyId('');
    }
  };

  const handleMarkAll = async () => {
    setBusyId('all');
    try {
      await markAllNotificationsAsRead();
      await load();
    } catch {
      setError(t('notificationsMarkReadError'));
    } finally {
      setBusyId('');
    }
  };

  const handleOpen = async (row: AppNotification) => {
    await handleMarkRead(row);
    const path = toAppPath(row.actionUrl);
    if (path) navigate(path);
  };

  return (
    <div className="notifications-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('notifications')}</h1>
          <p className="page-subtitle">{t('notificationsSubtitle')}</p>
        </div>
        <div className="notifications-header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
            {t('refresh')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleMarkAll()}
            disabled={loading || unreadCount === 0 || busyId === 'all'}
          >
            {t('notificationsMarkAllRead')}
          </button>
        </div>
      </div>

      <section className="notifications-channels" aria-label={t('notificationTypesHeading')}>
        <h2 className="notifications-section-title">{t('notificationTypesHeading')}</h2>
        <ul className="notifications-channel-list">
          <li>
            <strong>{t('notificationChannel_email')}</strong>
            <span>{t('notificationChannel_emailHint')}</span>
          </li>
          <li>
            <strong>{t('notificationChannel_sms')}</strong>
            <span>{t('notificationChannel_smsHint')}</span>
          </li>
          <li>
            <strong>{t('notificationChannel_online')}</strong>
            <span>{t('notificationChannel_onlineHint')}</span>
          </li>
        </ul>
      </section>

      {error ? <p className="form-error">{error}</p> : null}

      <section className="notifications-inbox" aria-label={t('notificationsInboxHeading')}>
        <div className="notifications-inbox-header">
          <h2 className="notifications-section-title">{t('notificationsInboxHeading')}</h2>
          <span className="notifications-unread">
            {t('notificationsUnreadCount').replace('{count}', String(unreadCount))}
          </span>
        </div>

        {loading ? (
          <p className="notifications-empty">{t('loading')}</p>
        ) : rows.length === 0 ? (
          <p className="notifications-empty">{t('notificationsEmpty')}</p>
        ) : (
          <ul className="notifications-list">
            {rows.map((row) => (
              <li key={row.id} className={`notifications-item${row.read ? '' : ' is-unread'}`}>
                <div className="notifications-item-main">
                  <p className="notifications-item-message">{row.message}</p>
                  <div className="notifications-item-meta">
                    <time dateTime={row.createdAt}>
                      {formatNotificationTimestamp(row.createdAt, language)}
                    </time>
                    <span className="notifications-item-channels">
                      {(row.channels ?? ['online']).map((channel) => (
                        <span key={channel} className={`notifications-channel-tag channel-${channel}`}>
                          {t(notificationChannelLabelKey(channel))}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
                <div className="notifications-item-actions">
                  {row.actionUrl ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void handleOpen(row)}
                      disabled={busyId === row.id}
                    >
                      {t('notificationsOpen')}
                    </button>
                  ) : null}
                  {!row.read ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void handleMarkRead(row)}
                      disabled={busyId === row.id}
                    >
                      {t('notificationsMarkRead')}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
