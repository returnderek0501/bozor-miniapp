import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../../components/Header/Header';
import { useUserStore } from '../../store/userStore';
import './ProfileScreen.css';

const OPERATOR_USERNAME = 'bozor_operator';

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserStore();

  const handleContactOperator = () => {
    window.Telegram?.WebApp?.hapticFeedback?.impactOccurred('medium');
    const url = `https://t.me/${OPERATOR_USERNAME}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleExit = () => {
    window.Telegram?.WebApp?.hapticFeedback?.impactOccurred('light');
    navigate('/');
  };

  const menuItems = [
    { icon: '✉️', label: t('profile.writeOperator'), action: handleContactOperator, accent: true },
    { icon: '💼', label: t('profile.myPortfolio'), action: () => navigate('/portfolio') },
    { icon: '⚙️', label: t('profile.settings'), action: () => {} },
    { icon: '🚪', label: t('profile.exit'), action: handleExit, danger: true },
  ];

  const initials = profile.displayName?.[0]?.toUpperCase() || 'I';

  return (
    <div className="profile-screen">
      <Header title={t('profile.title')} />

      <div className="profile-body">
        <div className="profile-card">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-info">
            <div className="profile-name">
              {profile.displayName || t('profile.defaultName')}
            </div>
            <div className="profile-level">
              <span className="profile-level__badge">⭐ {profile.level || t('profile.level')}</span>
            </div>
          </div>
        </div>

        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat__val">{profile.totalSignals}</div>
            <div className="profile-stat__label">{t('profile.totalSignals')}</div>
          </div>
          <div className="profile-stat-divider" />
          <div className="profile-stat">
            <div className="profile-stat__val profile-stat__val--green">{profile.successRate}%</div>
            <div className="profile-stat__label">{t('profile.successRate')}</div>
          </div>
          <div className="profile-stat-divider" />
          <div className="profile-stat">
            <div className="profile-stat__val">{profile.memberSince}</div>
            <div className="profile-stat__label">{t('profile.since')}</div>
          </div>
        </div>

        <div className="profile-menu">
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              className={`profile-menu-item ${item.accent ? 'profile-menu-item--accent' : ''} ${item.danger ? 'profile-menu-item--danger' : ''}`}
              onClick={item.action}
            >
              <span className="profile-menu-item__icon">{item.icon}</span>
              <span className="profile-menu-item__label">{item.label}</span>
              <span className="profile-menu-item__arrow">→</span>
            </button>
          ))}
        </div>

        <div className="profile-slogan">
          <div className="profile-slogan__logo">Bozor</div>
          <div className="profile-slogan__tagline">{t('profile.tagline')}</div>
        </div>

        <div style={{ height: 90 }} />
      </div>
    </div>
  );
}
