import { useNavigate } from 'react-router-dom';
import type { Instrument } from '../../types';
import './InstrumentCard.css';

interface InstrumentCardProps {
  instrument: Instrument;
  variant?: 'carousel' | 'list';
}

export function InstrumentCard({ instrument, variant = 'list' }: InstrumentCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    window.Telegram?.WebApp?.hapticFeedback?.impactOccurred('light');
    navigate(`/instrument/${instrument.id}`);
  };

  const isPositive = instrument.changePercent24h >= 0;
  const formatPrice = (price: number) => {
    if (price > 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (price > 10) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(4)}`;
  };

  if (variant === 'carousel') {
    return (
      <button className="instrument-card instrument-card--carousel" onClick={handleClick}>
        <div className="instrument-card__emoji">{instrument.iconEmoji}</div>
        <div className="instrument-card__symbol">{instrument.symbol.split('/')[0]}</div>
        <div className="instrument-card__price-mini">{formatPrice(instrument.price)}</div>
        <div className={`instrument-card__change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(instrument.changePercent24h).toFixed(2)}%
        </div>
        <div className={`instrument-card__mini-bar ${isPositive ? 'positive' : 'negative'}`} />
      </button>
    );
  }

  return (
    <button className="instrument-card instrument-card--list" onClick={handleClick}>
      <div className="instrument-card__left">
        <div className="instrument-card__icon-wrap">
          <span className="instrument-card__emoji">{instrument.iconEmoji}</span>
        </div>
        <div className="instrument-card__info">
          <span className="instrument-card__symbol">{instrument.symbol}</span>
          <span className="instrument-card__name">{instrument.name}</span>
        </div>
      </div>

      <div className="instrument-card__right">
        <span className="instrument-card__price">{formatPrice(instrument.price)}</span>
        <span className={`instrument-card__change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? '+' : ''}{instrument.changePercent24h.toFixed(2)}%
        </span>
      </div>
    </button>
  );
}
