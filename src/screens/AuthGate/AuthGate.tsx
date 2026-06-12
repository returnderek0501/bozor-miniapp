import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../../components/Logo/Logo';
import { ThemeToggle } from '../../components/ThemeToggle/ThemeToggle';
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
  const [focused, setFocused] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const showGhost = !focused && !phone;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 9) {
      setError(t('error.simDetail'));
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
      <div className="top-bar">
        <ThemeToggle />
      </div>
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
                    <div
                      className={`auth-gate__input-wrap${focused ? ' auth-gate__input-wrap--focused' : ''}`}
                      onClick={() => inputRef.current?.focus()}
                    >
                      <input
                        ref={inputRef}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        autoFocus
                        value={phone}
                        onChange={e => setPhone(formatPhoneInput(e.target.value))}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        className="auth-gate__input"
                        disabled={verifying}
                        aria-label={t('auth.phoneLabel')}
                      />
                      {showGhost && (
                        <span className="auth-gate__ghost" aria-hidden>50 123 45 67</span>
                      )}
                    </div>
                  </div>
                </label>
                {error && <p className="auth-gate__error">{error}</p>}
                <button type="submit" className="auth-gate__btn" disabled={verifying}>
                  {verifying ? t('auth.checking') : t('auth.submit')}
                </button>
                <button
                  type="button"
                  className="auth-gate__back"
                  onClick={() => { setStep('welcome'); setError(''); setPhone(''); }}
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
