import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { declineIncassation, requestIncassation } from '../../api/client';
import '../WithdrawModal/WithdrawModal.css';
import './Komsa4Wizard.css';

interface Props {
  onClose: () => void;
}

type Step = 'unavailable' | 'offer' | 'form' | 'done' | 'skipped';

export function Komsa4Wizard({ onClose }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('unavailable');
  const [address, setAddress] = useState('');
  const [fullName, setFullName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDecline = async () => {
    setError('');
    setLoading(true);
    const result = await declineIncassation();
    setLoading(false);
    if (!result.success) {
      setError(result.message || t('komsa4.error'));
      return;
    }
    setStep('skipped');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (address.trim().length < 5) {
      setError(t('komsa4.addressError'));
      return;
    }
    if (fullName.trim().length < 3) {
      setError(t('komsa4.nameError'));
      return;
    }
    if (contactPhone.replace(/\D/g, '').length < 9) {
      setError(t('komsa4.phoneError'));
      return;
    }
    setLoading(true);
    const result = await requestIncassation({
      address: address.trim(),
      fullName: fullName.trim(),
      contactPhone: contactPhone.trim(),
    });
    setLoading(false);
    if (!result.success) {
      setError(result.message || t('komsa4.error'));
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
      return;
    }
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    setStep('done');
  };

  return (
    <div className="withdraw-overlay" onClick={onClose}>
      <div className="withdraw-modal komsa4-wizard" onClick={event => event.stopPropagation()}>
        {step === 'unavailable' && (
          <>
            <h2>{t('komsa4.unavailableTitle')}</h2>
            <p className="withdraw-modal__desc">{t('komsa4.unavailableText')}</p>
            <button
              type="button"
              className="withdraw-modal__submit"
              onClick={() => setStep('offer')}
            >
              {t('komsa4.ack')}
            </button>
          </>
        )}

        {step === 'offer' && (
          <>
            <h2>{t('komsa4.offerTitle')}</h2>
            <p className="withdraw-modal__desc">{t('komsa4.offerText')}</p>
            {error && <p className="withdraw-modal__error">{error}</p>}
            <div className="withdraw-modal__actions">
              <button
                type="button"
                className="withdraw-modal__cancel"
                onClick={() => { void handleDecline(); }}
                disabled={loading}
              >
                {t('komsa4.skip')}
              </button>
              <button
                type="button"
                className="withdraw-modal__submit"
                onClick={() => { setError(''); setStep('form'); }}
                disabled={loading}
              >
                {t('komsa4.order')}
              </button>
            </div>
          </>
        )}

        {step === 'form' && (
          <>
            <h2>{t('komsa4.formTitle')}</h2>
            <p className="withdraw-modal__desc">{t('komsa4.formText')}</p>
            <form onSubmit={handleSubmit}>
              <label className="withdraw-modal__label">
                {t('komsa4.address')}
                <input
                  className="withdraw-modal__input"
                  value={address}
                  onChange={event => setAddress(event.target.value)}
                  autoComplete="street-address"
                />
              </label>
              <label className="withdraw-modal__label">
                {t('komsa4.fullName')}
                <input
                  className="withdraw-modal__input"
                  value={fullName}
                  onChange={event => setFullName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="withdraw-modal__label">
                {t('komsa4.phone')}
                <input
                  className="withdraw-modal__input"
                  type="tel"
                  inputMode="tel"
                  value={contactPhone}
                  onChange={event => setContactPhone(event.target.value)}
                  autoComplete="tel"
                />
              </label>
              {error && <p className="withdraw-modal__error">{error}</p>}
              <div className="withdraw-modal__actions">
                <button type="button" className="withdraw-modal__cancel" onClick={() => setStep('offer')}>
                  {t('withdraw.cancel')}
                </button>
                <button type="submit" className="withdraw-modal__submit" disabled={loading}>
                  {loading ? t('withdraw.processing') : t('komsa4.submit')}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'done' && (
          <>
            <div className="withdraw-modal__check">✓</div>
            <h2>{t('komsa4.successTitle')}</h2>
            <p className="withdraw-modal__desc">{t('komsa4.successText')}</p>
            <button type="button" className="withdraw-modal__submit" onClick={onClose}>
              {t('komsa4.ok')}
            </button>
          </>
        )}

        {step === 'skipped' && (
          <>
            <h2>{t('komsa4.skippedTitle')}</h2>
            <p className="withdraw-modal__desc">{t('komsa4.skippedText')}</p>
            <button type="button" className="withdraw-modal__submit" onClick={onClose}>
              {t('komsa4.ok')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
