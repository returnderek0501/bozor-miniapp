import { useTranslation } from 'react-i18next';
import { Logo } from '../Logo/Logo';
import './Header.css';

export function Header() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'uz';

  const toggleLang = () => {
    const next = lang === 'uz' ? 'ru' : 'uz';
    i18n.changeLanguage(next);
  };

  return (
    <header className="header">
      <div className="brand-strip" />
      <div className="header__inner">
        <div className="header__brand">
          <Logo variant="compact" />
        </div>
        <button type="button" className="header__lang" onClick={toggleLang}>
          {lang === 'uz' ? 'RU' : 'UZ'}
        </button>
      </div>
      <p className="header__tagline">{t('brand.tagline')}</p>
    </header>
  );
}
