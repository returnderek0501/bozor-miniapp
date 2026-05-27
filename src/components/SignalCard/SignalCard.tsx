import { useTranslation } from 'react-i18next';
import type { Signal } from '../../types';
import { useSignalStore } from '../../store/signalStore';
import './SignalCard.css';

interface SignalCardProps {
  signal: Signal;
  compact?: boolean;
}

export function SignalCard({ signal, compact = false }: SignalCardProps) {
  const { t } = useTranslation();
  const { openSignalDetail, markSignalSeen } = useSignalStore();

  const handleClick = () => {
    markSignalSeen(signal.id);
    openSignalDetail(signal.id);
    window.Telegram?.WebApp?.hapticFeedback?.impactOccurred('medium');
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

  const typeClass = () => {
    if (signal.type.includes('BUY')) return 'buy';
    if (signal.type.includes('SELL')) return 'sell';
    return 'hold';
  };

  const statusLabel = () => {
    switch (signal.status) {
      case 'new': return t('signal.new');
      case 'seen': return t('signal.seen');
      case 'informed': return t('signal.informed');
    }
  };

  const formatPrice = (price: number) => {
    if (price > 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (price > 10) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  return (
    <button
      className={`signal-card signal-card--${typeClass()} ${signal.isUrgent ? 'signal-card--urgent' : ''} ${compact ? 'signal-card--compact' : ''}`}
      onClick={handleClick}
    >
      {signal.isUrgent && (
        <div className="signal-card__urgent-badge">
          🚨 СРОЧНО
        </div>
      )}

      <div className="signal-card__top">
        <div className="signal-card__instrument">
          <span className="signal-card__emoji">{signal.iconEmoji}</span>
          <div className="signal-card__names">
            <span className="signal-card__symbol">{signal.instrumentSymbol}</span>
            <span className="signal-card__name">{signal.instrumentName}</span>
          </div>
        </div>
        <div className={`signal-card__type signal-card__type--${typeClass()}`}>
          {typeLabel()}
        </div>
      </div>

      {!compact && (
        <>
          <div className="signal-card__price">{formatPrice(signal.price)}</div>

          <div className="signal-card__stats">
            <div className="signal-card__stat">
              <span className="signal-card__stat-label">{t('signal.target')}</span>
              <span className="signal-card__stat-value signal-card__stat-value--green">
                {formatPrice(signal.targetPrice)}
              </span>
            </div>
            <div className="signal-card__stat">
              <span className="signal-card__stat-label">{t('signal.potential')}</span>
              <span className={`signal-card__stat-value ${typeClass() === 'buy' ? 'signal-card__stat-value--green' : 'signal-card__stat-value--red'}`}>
                {typeClass() === 'sell' ? '-' : '+'}{signal.potential}%
              </span>
            </div>
            <div className="signal-card__stat">
              <span className="signal-card__stat-label">{t('signal.timeframe')}</span>
              <span className="signal-card__stat-value">{signal.timeframe}</span>
            </div>
          </div>

          <div className="signal-card__desc">{signal.description}</div>
        </>
      )}

      {compact && (
        <div className="signal-card__compact-row">
          <span className="signal-card__stat-value">{formatPrice(signal.price)}</span>
          <span className={`signal-card__stat-value ${typeClass() === 'buy' ? 'signal-card__stat-value--green' : 'signal-card__stat-value--red'}`}>
            {typeClass() === 'sell' ? '-' : '+'}{signal.potential}%
          </span>
        </div>
      )}

      <div className="signal-card__footer">
        <span className={`signal-card__status signal-card__status--${signal.status}`}>
          {statusLabel()}
        </span>
        <span className="signal-card__time">{signal.timeframe}</span>
        <span className="signal-card__arrow">→</span>
      </div>
    </button>
  );
}
