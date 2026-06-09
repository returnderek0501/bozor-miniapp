import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { requestWithdraw } from '../../api/client';
import './WithdrawModal.css';

interface Props {
  balance: number;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

function formatCardInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatMoney(n: number) {
  return Number(n || 0).toLocaleString('uz-UZ');
}

export function WithdrawModal({ balance, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [card, setCard] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ amount: number; balance: number } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const digits = card.replace(/\D/g, '');
    if (digits.length < 12) {
      setError(t('withdraw.invalidCard'));
      return;
    }

    setLoading(true);
    const parsedAmount = amount ? Number(amount.replace(/\s/g, '')) : undefined;
    const result = await requestWithdraw(digits, parsedAmount);

    if (result.success && result.balance !== undefined && result.amount !== undefined) {
      setSuccess({ amount: result.amount, balance: result.balance });
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } else {
      setError(result.message || t('withdraw.cardError'));
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="withdraw-overlay" onClick={onClose}>
        <div className="withdraw-modal withdraw-modal--success" onClick={e => e.stopPropagation()}>
          <div className="withdraw-modal__check">✓</div>
          <h2>{t('withdraw.success')}</h2>
          <p>{t('withdraw.successAmount', { amount: formatMoney(success.amount) })}</p>
          <p>{t('withdraw.successBalance', { balance: formatMoney(success.balance) })}</p>
          <button
            type="button"
            className="withdraw-modal__submit"
            onClick={() => onSuccess(success.balance)}
          >
            {t('withdraw.close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="withdraw-overlay" onClick={onClose}>
      <div className="withdraw-modal" onClick={e => e.stopPropagation()}>
        <h2>{t('withdraw.title')}</h2>
        <p className="withdraw-modal__desc">{t('withdraw.description')}</p>

        <form onSubmit={handleSubmit}>
          <label className="withdraw-modal__label">
            {t('withdraw.cardLabel')}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('withdraw.cardPlaceholder')}
              value={card}
              onChange={e => setCard(formatCardInput(e.target.value))}
              className="withdraw-modal__input"
            />
          </label>

          <label className="withdraw-modal__label">
            {t('withdraw.amountLabel')}
            <input
              type="text"
              inputMode="numeric"
              placeholder={formatMoney(balance)}
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^\d\s]/g, ''))}
              className="withdraw-modal__input"
            />
            <span className="withdraw-modal__hint">{t('withdraw.amountHint')}</span>
          </label>

          {error && <p className="withdraw-modal__error">{error}</p>}

          <div className="withdraw-modal__actions">
            <button type="button" className="withdraw-modal__cancel" onClick={onClose}>
              {t('withdraw.cancel')}
            </button>
            <button type="submit" className="withdraw-modal__submit" disabled={loading}>
              {loading ? t('withdraw.processing') : t('withdraw.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
