import { useAppStore } from '../../store/appStore';
import { useUserStore } from '../../store/userStore';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import './Header.css';

interface HeaderProps {
  title?: string;
  showLang?: boolean;
  showNotif?: boolean;
  onBack?: () => void;
}

export function Header({ title, showLang = false, showNotif = false, onBack }: HeaderProps) {
  const { language, setLanguage, toggleNotificationPopup } = useAppStore();
  const { profile } = useUserStore();
  useTranslation();

  const unreadCount = profile.notifications.filter(n => !n.isRead).length;

  const switchLang = () => {
    const newLang = language === 'ru' ? 'uz' : 'ru';
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  return (
    <header className="header">
      <div className="header__left">
        {onBack ? (
          <button className="header__back" onClick={onBack}>
            ←
          </button>
        ) : (
          <span className="header__logo">Bozor</span>
        )}
        {title && <span className="header__title">{title}</span>}
      </div>

      <div className="header__right">
        {showLang && (
          <button className="header__lang" onClick={switchLang}>
            <span className={language === 'uz' ? 'active' : ''}>UZ</span>
            <span className="sep">/</span>
            <span className={language === 'ru' ? 'active' : ''}>RU</span>
          </button>
        )}

        {showNotif && (
          <button className="header__notif" onClick={toggleNotificationPopup}>
            🔔
            {unreadCount > 0 && (
              <span className="header__badge">{unreadCount}</span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
