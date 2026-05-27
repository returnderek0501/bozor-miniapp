import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/appStore';
import { useSignalStore } from '../../store/signalStore';
import './NotificationPopup.css';

export function NotificationPopup() {
  const { t } = useTranslation();
  const { showNotificationPopup, closeNotificationPopup, notifications, markAllRead, markNotificationRead } = useAppStore();
  const { openSignalDetail } = useSignalStore();

  if (!showNotificationPopup) return null;

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 1) return t('notifications.now');
    if (mins < 60) return `${mins} ${t('notifications.minutesAgo')}`;
    return `${hours} ${t('notifications.hoursAgo')}`;
  };

  const handleNotifClick = (notif: typeof notifications[0]) => {
    markNotificationRead(notif.id);
    if (notif.signalId) {
      closeNotificationPopup();
      openSignalDetail(notif.signalId);
    }
  };

  return (
    <div className="notif-overlay" onClick={(e) => e.target === e.currentTarget && closeNotificationPopup()}>
      <div className="notif-popup">
        <div className="notif-popup__handle" />

        <div className="notif-popup__header">
          <h3 className="notif-popup__title">{t('notifications.title')}</h3>
          <button className="notif-popup__mark-all" onClick={markAllRead}>
            {t('notifications.markAllRead')}
          </button>
        </div>

        <div className="notif-popup__list">
          {notifications.length === 0 ? (
            <div className="notif-popup__empty">{t('notifications.empty')}</div>
          ) : (
            notifications.map(notif => (
              <button
                key={notif.id}
                className={`notif-item ${!notif.isRead ? 'notif-item--unread' : ''} notif-item--${notif.type}`}
                onClick={() => handleNotifClick(notif)}
              >
                <div className="notif-item__dot" />
                <div className="notif-item__content">
                  <div className="notif-item__title">{notif.title}</div>
                  <div className="notif-item__body">{notif.body}</div>
                  <div className="notif-item__time">{formatTime(notif.createdAt)}</div>
                </div>
                {notif.signalId && <span className="notif-item__arrow">→</span>}
              </button>
            ))
          )}
        </div>

        <button className="notif-popup__close-btn" onClick={closeNotificationPopup}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
