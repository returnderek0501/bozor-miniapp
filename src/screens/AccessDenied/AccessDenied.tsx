import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle';
import './AccessDenied.css';

interface Props {
  message: string;
  onRetry: () => void;
}

export function AccessDenied({ message, onRetry }: Props) {
  const { t } = useTranslation();

  return (
    <div className="access-denied">
      <div className="top-bar">
        <ThemeToggle />
      </div>
      <div className="access-denied__strip" />
      <div className="access-denied__body">
        <div className="access-denied__icon" aria-hidden>!</div>
        <h1>{t('error.title')}</h1>
        <p className="access-denied__detail">{message || t('error.simDetail')}</p>
        <button type="button" className="access-denied__btn" onClick={onRetry}>
          {t('error.retry')}
        </button>
      </div>
    </div>
  );
}
