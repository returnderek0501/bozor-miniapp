import { useTranslation } from 'react-i18next';
import './ProfileScreen.css';

interface Props {
  phone?: string;
  name?: string;
}

export function ProfileScreen({ phone, name }: Props) {
  const { t } = useTranslation();

  return (
    <main className="profile">
      <h2>{t('profile.title')}</h2>
      <div className="profile__card">
        <div className="profile__avatar">{name?.charAt(0) || 'U'}</div>
        <div className="profile__info">
          <div className="profile__row">
            <span>{t('profile.phone')}</span>
            <strong>{phone || '—'}</strong>
          </div>
          <div className="profile__row">
            <span>{t('profile.status')}</span>
            <strong className="profile__status">{t('profile.active')}</strong>
          </div>
        </div>
      </div>
    </main>
  );
}
