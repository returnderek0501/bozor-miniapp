import { useTranslation } from 'react-i18next';
import './ServicesScreen.css';

const ITEMS = ['telecom', 'digital', 'infra', 'innovation'] as const;

export function ServicesScreen() {
  const { t } = useTranslation();

  return (
    <main className="services">
      <h2>{t('services.title')}</h2>
      <ul className="services__list">
        {ITEMS.map(key => (
          <li key={key} className="services__item">
            <div>
              <strong>{t(`services.${key}`)}</strong>
              <p>{t('home.placeholder')}</p>
            </div>
            <span className="services__arrow">›</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
