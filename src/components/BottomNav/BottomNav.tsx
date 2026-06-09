import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './BottomNav.css';

export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`} end>
        <span className="bottom-nav__icon">⌂</span>
        <span>{t('nav.cabinet')}</span>
      </NavLink>
      <NavLink to="/documents" className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}>
        <span className="bottom-nav__icon">📄</span>
        <span>{t('nav.documents')}</span>
      </NavLink>
    </nav>
  );
}
