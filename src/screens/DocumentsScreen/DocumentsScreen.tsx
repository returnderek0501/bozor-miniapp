import { useTranslation } from 'react-i18next';
import './DocumentsScreen.css';

export function DocumentsScreen() {
  const { t } = useTranslation();

  return (
    <main className="documents">
      <h2>{t('documents.title')}</h2>
      <div className="documents__placeholder">
        <p>{t('documents.placeholder')}</p>
      </div>
    </main>
  );
}
