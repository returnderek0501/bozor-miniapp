import { useTranslation } from 'react-i18next';
import { useSignalStore } from '../../store/signalStore';
import './SignalDetailPopup.css';

const OPERATOR_USERNAME = 'bozor_operator';

export function SignalDetailPopup() {
  const { t } = useTranslation();
  const { showSignalDetail, activeSignalId, signals, closeSignalDetail, updateSignalStatus } = useSignalStore();

  const signal = signals.find(s => s.id === activeSignalId);

  if (!showSignalDetail || !signal) return null;

  const isBuy = signal.type === 'BUY' || signal.type === 'BUY_URGENT';
  const isSell = signal.type === 'SELL' || signal.type === 'SELL_URGENT';

  const handlePrimaryAction = () => {
    window.Telegram?.WebApp?.hapticFeedback?.notificationOccurred('success');
    updateSignalStatus(signal.id, 'seen');
    closeSignalDetail();
  };

  const handleContactOperator = () => {
    window.Telegram?.WebApp?.hapticFeedback?.impactOccurred('heavy');
    updateSignalStatus(signal.id, 'informed');
    const msg = encodeURIComponent(
      `Привет! Я хочу уточнить по сигналу: ${signal.type} ${signal.instrumentSymbol} @ $${signal.price}. Потенциал: +${signal.potential}%`
    );
    const url = `https://t.me/${OPERATOR_USERNAME}?text=${msg}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const formatPrice = (price: number) => {
    if (price > 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (price > 10) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  const typeLabel = () => {
    switch (signal.type) {
      case 'BUY_URGENT': return t('signal.buyUrgent');
      case 'SELL_URGENT': return t('signal.sellUrgent');
      case 'BUY': return t('signal.buy');
      case 'SELL': return t('signal.sell');
      case 'HOLD': return t('signal.hold');
    }
  };

  const typeClass = isBuy ? 'buy' : isSell ? 'sell' : 'hold';

  return (
    <div className="signal-detail-overlay" onClick={(e) => e.target === e.currentTarget && closeSignalDetail()}>
      <div className="signal-detail-popup">
        <div className="signal-detail__handle" />

        <div className="signal-detail__header">
          <span className="signal-detail__emoji">{signal.iconEmoji}</span>
          <div className="signal-detail__title-block">
            <div className="signal-detail__symbol">{signal.instrumentSymbol}</div>
            <div className="signal-detail__name">{signal.instrumentName}</div>
          </div>
          <button className="signal-detail__close" onClick={closeSignalDetail}>✕</button>
        </div>

        <div className={`signal-detail__type signal-detail__type--${typeClass}`}>
          {typeLabel()}
        </div>

        <div className="signal-detail__price">{formatPrice(signal.price)}</div>

        <div className="signal-detail__stats-grid">
          <div className="signal-detail__stat">
            <span className="signal-detail__stat-label">{t('signal.target')}</span>
            <span className="signal-detail__stat-val green">{formatPrice(signal.targetPrice)}</span>
          </div>
          <div className="signal-detail__stat">
            <span className="signal-detail__stat-label">{t('signal.stopLoss')}</span>
            <span className="signal-detail__stat-val red">{formatPrice(signal.stopLoss)}</span>
          </div>
          <div className="signal-detail__stat">
            <span className="signal-detail__stat-label">{t('signal.potential')}</span>
            <span className={`signal-detail__stat-val ${isBuy ? 'green' : 'red'}`}>
              {isBuy ? '+' : '-'}{signal.potential}%
            </span>
          </div>
          <div className="signal-detail__stat">
            <span className="signal-detail__stat-label">{t('signal.timeframe')}</span>
            <span className="signal-detail__stat-val">{signal.timeframe}</span>
          </div>
        </div>

        <div className="signal-detail__reason-block">
          <div className="signal-detail__reason-title">💡 {t('signal.reason')}</div>
          <div className="signal-detail__reason-text">{signal.reason}</div>
        </div>

        <div className="signal-detail__actions">
          {signal.isUrgent ? (
            <button
              className="signal-detail__btn signal-detail__btn--urgent"
              onClick={handleContactOperator}
            >
              {t('signal.contactOperator')}
            </button>
          ) : (
            <button
              className={`signal-detail__btn signal-detail__btn--primary signal-detail__btn--${typeClass}`}
              onClick={handlePrimaryAction}
            >
              {t('signal.iSawSignal')}
            </button>
          )}

          {signal.status !== 'informed' && !signal.isUrgent && (
            <button
              className="signal-detail__btn signal-detail__btn--secondary"
              onClick={handleContactOperator}
            >
              {t('signal.writeOperatorNow')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
