import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './BottomNav.css';

export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`} end>
        <span className="bottom-nav__icon">⌂</span>
        <span>{t('nav.home')}</span>
      </NavLink>
      <NavLink to="/services" className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}>
        <span className="bottom-nav__icon">☰</span>
        <span>{t('nav.services')}</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}>
        <span className="bottom-nav__icon">◉</span>
        <span>{t('nav.profile')}</span>
      </NavLink>
    </nav>
  );
}
