import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSignalStore } from '../../store/signalStore';
import './UrgentSignalPopup.css';

const OPERATOR_USERNAME = 'bozor_operator';

export function UrgentSignalPopup() {
  const { t } = useTranslation();
  const { showUrgentPopup, urgentSignalId, closeUrgentPopup, signals, updateSignalStatus } = useSignalStore();
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  const signal = signals.find(s => s.id === urgentSignalId);

  useEffect(() => {
    if (!showUrgentPopup) return;
    setTimeLeft(15 * 60);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showUrgentPopup, urgentSignalId]);

  useEffect(() => {
    if (showUrgentPopup) {
      window.Telegram?.WebApp?.hapticFeedback?.notificationOccurred('warning');
    }
  }, [showUrgentPopup]);

  if (!showUrgentPopup || !signal) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  const isBuy = signal.type === 'BUY_URGENT';

  const handleContactOperator = () => {
    window.Telegram?.WebApp?.hapticFeedback?.impactOccurred('heavy');
    if (signal) updateSignalStatus(signal.id, 'informed');
    const msg = encodeURIComponent(
      `Привет! Я хочу действовать по сигналу: ${signal.type === 'BUY_URGENT' ? 'ПОКУПАЙ СРОЧНО' : 'ПРОДАВАЙ СРОЧНО'} ${signal.instrumentSymbol} @ $${signal.price}`
    );
    const url = `https://t.me/${OPERATOR_USERNAME}?text=${msg}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleDismiss = () => {
    window.Telegram?.WebApp?.hapticFeedback?.impactOccurred('light');
    if (signal) updateSignalStatus(signal.id, 'seen');
    closeUrgentPopup();
  };

  const formatPrice = (price: number) => {
    if (price > 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return `$${price.toFixed(2)}`;
  };

  return (
    <div className="urgent-overlay" onClick={(e) => e.target === e.currentTarget && handleDismiss()}>
      <div className={`urgent-popup ${isBuy ? 'urgent-popup--buy' : 'urgent-popup--sell'}`}>
        <div className="urgent-popup__bg-anim" />

        <div className="urgent-popup__icon">
          {isBuy ? '🚀' : '🔴'}
        </div>

        <div className="urgent-popup__badge">
          🚨 {t('urgent.title')}
        </div>

        <div className="urgent-popup__subtitle">{t('urgent.subtitle')}</div>

        <div className="urgent-popup__signal-name">
          {signal.iconEmoji} {signal.instrumentSymbol}
        </div>

        <div className={`urgent-popup__action-type ${isBuy ? 'buy' : 'sell'}`}>
          {isBuy ? t('signal.buyUrgent') : t('signal.sellUrgent')}
        </div>

        <div className="urgent-popup__price-block">
          <div className="urgent-popup__price-row">
            <span className="urgent-popup__price-label">Вход</span>
            <span className="urgent-popup__price-val">{formatPrice(signal.price)}</span>
          </div>
          <div className="urgent-popup__divider" />
          <div className="urgent-popup__price-row">
            <span className="urgent-popup__price-label">{t('signal.target')}</span>
            <span className="urgent-popup__price-val urgent-popup__price-val--green">{formatPrice(signal.targetPrice)}</span>
          </div>
          <div className="urgent-popup__divider" />
          <div className="urgent-popup__price-row">
            <span className="urgent-popup__price-label">{t('signal.stopLoss')}</span>
            <span className="urgent-popup__price-val urgent-popup__price-val--red">{formatPrice(signal.stopLoss)}</span>
          </div>
        </div>

        <div className="urgent-popup__timer-block">
          <div className="urgent-popup__timer-label">⏱ {t('urgent.timer')}</div>
          <div className={`urgent-popup__timer ${timeLeft < 60 ? 'urgent-popup__timer--critical' : ''}`}>
            {pad(minutes)}:{pad(seconds)}
          </div>
          <div className="urgent-popup__timer-sub">{t('urgent.minutes')}</div>
        </div>

        <div className="urgent-popup__actions">
          <button
            className="urgent-popup__btn urgent-popup__btn--primary"
            onClick={handleContactOperator}
          >
            {t('urgent.writeNow')}
          </button>
          <button
            className="urgent-popup__btn urgent-popup__btn--secondary"
            onClick={handleDismiss}
          >
            {t('urgent.understood')}
          </button>
        </div>
      </div>
    </div>
  );
}
