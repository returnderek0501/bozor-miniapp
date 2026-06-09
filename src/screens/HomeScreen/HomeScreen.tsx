import { useTranslation } from 'react-i18next';
import './HomeScreen.css';

interface Props {
  userName?: string;
}

const SECTIONS = [
  { key: 'telecom', icon: '📡' },
  { key: 'digital', icon: '💻' },
  { key: 'infra', icon: '🏗' },
  { key: 'innovation', icon: '🔬' },
] as const;

export function HomeScreen({ userName }: Props) {
  const { t } = useTranslation();

  return (
    <main className="home">
      <section className="home__hero">
        <span className="home__badge">{t('home.demo')}</span>
        <h2>{t('home.welcome')}{userName ? `, ${userName}` : ''}</h2>
        <p>{t('home.demoNote')}</p>
      </section>

      <section className="home__section">
        <h3>{t('home.sections')}</h3>
        <div className="home__grid">
          {SECTIONS.map(({ key, icon }) => (
            <div key={key} className="home__card">
              <span className="home__card-icon">{icon}</span>
              <span className="home__card-title">{t(`services.${key}`)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home__section">
        <h3>{t('home.about')}</h3>
        <div className="home__about">
          <p>{t('home.aboutText')}</p>
          <span className="home__link">{t('home.readMore')} ›</span>
        </div>
      </section>

      <section className="home__section">
        <h3>{t('home.news')}</h3>
        <div className="home__placeholder">
          <p>{t('home.placeholder')}</p>
        </div>
      </section>
    </main>
  );
}
