import { useTranslation } from 'react-i18next';
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
      <div className="header__strip" />
      <div className="header__inner">
        <div className="header__brand">
          <div className="header__emblem" aria-hidden>
            <span>U</span>
          </div>
          <div>
            <h1 className="header__title">{t('brand.name')}</h1>
            <p className="header__subtitle">{t('brand.subtitle')}</p>
          </div>
        </div>
        <button type="button" className="header__lang" onClick={toggleLang}>
          {lang === 'uz' ? 'RU' : 'UZ'}
        </button>
      </div>
      <p className="header__tagline">{t('brand.tagline')}</p>
    </header>
  );
}
