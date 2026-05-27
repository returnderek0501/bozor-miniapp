import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './BottomNav.css';

const navItems = [
  { path: '/', icon: '🏠', key: 'home' },
  { path: '/markets', icon: '📊', key: 'markets' },
  { path: '/signals', icon: '🎯', key: 'signals' },
  { path: '/profile', icon: '👤', key: 'profile' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <nav className="bottom-nav">
      {navItems.map(item => {
        const isActive = item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path);

        return (
          <button
            key={item.key}
            className={`bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="bottom-nav__icon">{item.icon}</span>
            <span className="bottom-nav__label">{t(`nav.${item.key}`)}</span>
            {isActive && <span className="bottom-nav__indicator" />}
          </button>
        );
      })}
    </nav>
  );
}
