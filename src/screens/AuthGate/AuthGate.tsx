import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../../components/Logo/Logo';
import './AuthGate.css';

interface Props {
  onVerify: (phone: string) => Promise<void>;
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
}

export function AuthGate({ onVerify }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'welcome' | 'phone'>('welcome');
  const [phone, setPhone] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 9 || !digits.startsWith('9')) {
      setError(t('auth.phoneInvalid'));
      return;
    }

    setVerifying(true);
    try {
      await onVerify(`+998${digits}`);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="auth-gate">
      <div className="brand-strip" />
      <div className="auth-gate__body">
        <Logo variant="full" className="auth-gate__logo" />
        <p className="auth-gate__tagline">{t('brand.tagline')}</p>

        <div className="auth-gate__card">
          {step === 'welcome' ? (
            <>
              <h2>{t('auth.title')}</h2>
              <p>{t('auth.description')}</p>
              <button type="button" className="auth-gate__btn" onClick={() => setStep('phone')}>
                {t('auth.button')}
              </button>
            </>
          ) : (
            <>
              <h2>{t('auth.phoneTitle')}</h2>
              <p>{t('auth.phoneDescription')}</p>
              <form onSubmit={handleSubmit}>
                <label className="auth-gate__label">
                  {t('auth.phoneLabel')}
                  <div className="auth-gate__phone-row">
                    <span className="auth-gate__prefix">+998</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      autoFocus
                      placeholder="90 123 45 67"
                      value={phone}
                      onChange={e => setPhone(formatPhoneInput(e.target.value))}
                      className="auth-gate__input"
                      disabled={verifying}
                    />
                  </div>
                </label>
                {error && <p className="auth-gate__error">{error}</p>}
                <button type="submit" className="auth-gate__btn" disabled={verifying}>
                  {verifying ? t('auth.checking') : t('auth.submit')}
                </button>
                <button
                  type="button"
                  className="auth-gate__back"
                  onClick={() => { setStep('welcome'); setError(''); }}
                  disabled={verifying}
                >
                  {t('auth.back')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
