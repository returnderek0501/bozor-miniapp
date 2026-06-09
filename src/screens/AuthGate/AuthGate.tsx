import { useTranslation } from 'react-i18next';
import './AuthGate.css';

interface Props {
  onRequestContact: () => void;
}

export function AuthGate({ onRequestContact }: Props) {
  const { t } = useTranslation();

  return (
    <div className="auth-gate">
      <div className="auth-gate__strip" />
      <div className="auth-gate__body">
        <div className="auth-gate__emblem" aria-hidden>U</div>
        <p className="auth-gate__org">{t('brand.subtitle')}</p>
        <h1 className="auth-gate__title">{t('brand.name')}</h1>
        <p className="auth-gate__tagline">{t('brand.tagline')}</p>

        <div className="auth-gate__card">
          <h2>{t('auth.title')}</h2>
          <p>{t('auth.description')}</p>
          <button type="button" className="auth-gate__btn" onClick={onRequestContact}>
            {t('auth.button')}
          </button>
        </div>

        <p className="auth-gate__footer">{t('home.demo')}</p>
      </div>
    </div>
  );
}
