import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../../components/Header/Header';
import { useSignalStore } from '../../store/signalStore';
import './ProfileScreen.css';

const OPERATOR_USERNAME = 'bozor_operator';

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signals } = useSignalStore();

  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const totalSignals = signals.length;
  const informedSignals = signals.filter(s => s.status === 'informed').length;
  const successRate = totalSignals > 0 ? Math.round((informedSignals / totalSignals) * 100) : 78;

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

  return (
    <div className="profile-screen">
      <Header title={t('profile.title')} />

      <div className="profile-body">
        {/* Avatar + info */}
        <div className="profile-card">
          <div className="profile-avatar">
            {tgUser?.first_name?.[0] || 'A'}
          </div>
          <div className="profile-info">
            <div className="profile-name">
              {tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() : 'Инвестор'}
            </div>
            {tgUser?.username && (
              <div className="profile-username">@{tgUser.username}</div>
            )}
            <div className="profile-level">
              <span className="profile-level__badge">⭐ {t('profile.level')}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat__val">{totalSignals}</div>
            <div className="profile-stat__label">{t('profile.totalSignals')}</div>
          </div>
          <div className="profile-stat-divider" />
          <div className="profile-stat">
            <div className="profile-stat__val profile-stat__val--green">{successRate}%</div>
            <div className="profile-stat__label">{t('profile.successRate')}</div>
          </div>
          <div className="profile-stat-divider" />
          <div className="profile-stat">
            <div className="profile-stat__val">2024</div>
            <div className="profile-stat__label">{t('profile.since')}</div>
          </div>
        </div>

        {/* Menu */}
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

        {/* Slogan */}
        <div className="profile-slogan">
          <div className="profile-slogan__logo">Bozor</div>
          <div className="profile-slogan__tagline">Простые сигналы для каждого</div>
        </div>

        <div style={{ height: 90 }} />
      </div>
    </div>
  );
}
