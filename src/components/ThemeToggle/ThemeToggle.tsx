import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import './ThemeToggle.css';

export function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={t('theme.toggle')}
      title={t('theme.toggle')}
    >
      <span className="theme-toggle__icon" aria-hidden>
        {theme === 'dark' ? '☀' : '☾'}
      </span>
      <span className="theme-toggle__label">
        {theme === 'dark' ? t('theme.light') : t('theme.dark')}
      </span>
    </button>
  );
}
