import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Header } from '../../components/Header/Header';
import { SignalCard } from '../../components/SignalCard/SignalCard';
import { getInstrumentById } from '../../data/instruments';
import { getChartData } from '../../data/chartData';
import { getSignalsByInstrument } from '../../data/signals';
import { useSignalStore } from '../../store/signalStore';
import type { Signal } from '../../types';
import './InstrumentDetailScreen.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

type TimeframeKey = '1h' | '4h' | '1d' | '1w';

const OPERATOR_USERNAME = 'bozor_operator';

export function InstrumentDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addGeneratedSignal, openSignalDetail } = useSignalStore();
  const [activeTimeframe, setActiveTimeframe] = useState<TimeframeKey>('1d');
  const [isGenerating, setIsGenerating] = useState(false);

  const instrument = id ? getInstrumentById(id) : null;
  const chartData = id ? getChartData(id) : [];
  const relatedSignals = id ? getSignalsByInstrument(id) : [];

  useEffect(() => {
    window.Telegram?.WebApp?.BackButton?.show();
    window.Telegram?.WebApp?.BackButton?.onClick(() => navigate(-1));
    return () => window.Telegram?.WebApp?.BackButton?.hide();
  }, [navigate]);

  if (!instrument) {
    return (
      <div className="detail-screen">
        <Header onBack={() => navigate(-1)} />
        <div style={{ textAlign: 'center', padding: 40, color: '#9e9e9e' }}>Инструмент не найден</div>
      </div>
    );
  }

  const isPositive = instrument.changePercent24h >= 0;
  const timeframes: TimeframeKey[] = ['1h', '4h', '1d', '1w'];

  const getSlicedData = () => {
    const sliceMap = { '1h': 4, '4h': 12, '1d': 24, '1w': 48 };
    return chartData.slice(-sliceMap[activeTimeframe]);
  };

  const slicedData = getSlicedData();
  const priceColor = isPositive ? '#00C853' : '#FF3D00';

  const chartConfig = {
    labels: slicedData.map((_, i) => i % 4 === 0 ? i.toString() : ''),
    datasets: [{
      data: slicedData.map(d => d.value),
      borderColor: priceColor,
      backgroundColor: isPositive
        ? 'rgba(0, 200, 83, 0.08)'
        : 'rgba(255, 61, 0, 0.08)',
      borderWidth: 2.5,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: priceColor,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { display: false },
      y: {
        display: true,
        position: 'right' as const,
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        ticks: { color: '#9e9e9e', font: { size: 10 }, maxTicksLimit: 5 },
      },
    },
  };

  const handleGetSignal = async () => {
    window.Telegram?.WebApp?.hapticFeedback?.impactOccurred('heavy');
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 1400));

    const types: Signal['type'][] = ['BUY', 'SELL', 'BUY_URGENT'];
    const type = types[Math.floor(Math.random() * types.length)];
    const isBuy = type === 'BUY' || type === 'BUY_URGENT';

    const newSignal: Signal = {
      id: `gen-${Date.now()}`,
      instrumentId: instrument.id,
      instrumentSymbol: instrument.symbol,
      instrumentName: instrument.name,
      type,
      price: instrument.price,
      targetPrice: instrument.price * (isBuy ? 1.07 : 0.93),
      stopLoss: instrument.price * (isBuy ? 0.96 : 1.04),
      potential: parseFloat((Math.random() * 8 + 3).toFixed(2)),
      timeframe: ['4 часа', '1 день', '3 дня'][Math.floor(Math.random() * 3)],
      description: `Новый сигнал по ${instrument.symbol}. Аналитика подтверждает.`,
      reason: `AI-анализ графика ${instrument.symbol} показывает ${isBuy ? 'бычий' : 'медвежий'} паттерн. Объём подтверждает движение.`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      status: 'new',
      isUrgent: type === 'BUY_URGENT',
      iconEmoji: instrument.iconEmoji,
    };

    addGeneratedSignal(newSignal);
    setIsGenerating(false);
    window.Telegram?.WebApp?.hapticFeedback?.notificationOccurred('success');

    setTimeout(() => openSignalDetail(newSignal.id), 400);
  };

  const handleNotifyOperator = () => {
    window.Telegram?.WebApp?.hapticFeedback?.impactOccurred('medium');
    const msg = encodeURIComponent(`Привет! Меня интересует инструмент: ${instrument.symbol} (${instrument.name}). Текущая цена: $${instrument.price.toFixed(2)}`);
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

  return (
    <div className="detail-screen">
      <Header onBack={() => navigate(-1)} />

      <div className="detail-scroll">
        {/* Instrument header */}
        <div className="detail-header">
          <div className="detail-icon">{instrument.iconEmoji}</div>
          <div className="detail-info">
            <div className="detail-symbol">{instrument.symbol}</div>
            <div className="detail-name">{instrument.name}</div>
          </div>
          <div className="detail-price-block">
            <div className="detail-price">{formatPrice(instrument.price)}</div>
            <div className={`detail-change ${isPositive ? 'positive' : 'negative'}`}>
              {isPositive ? '+' : ''}{instrument.changePercent24h.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="detail-stats">
          <div className="detail-stat">
            <span className="detail-stat__label">{t('detail.volume')}</span>
            <span className="detail-stat__val">{instrument.volume24h}</span>
          </div>
          {instrument.marketCap && (
            <div className="detail-stat">
              <span className="detail-stat__label">{t('detail.marketCap')}</span>
              <span className="detail-stat__val">{instrument.marketCap}</span>
            </div>
          )}
          <div className="detail-stat">
            <span className="detail-stat__label">{t('detail.change24h')}</span>
            <span className={`detail-stat__val ${isPositive ? 'positive' : 'negative'}`}>
              {isPositive ? '+' : ''}{instrument.change24h.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="detail-chart-section">
          <div className="detail-timeframes">
            {timeframes.map(tf => (
              <button
                key={tf}
                className={`detail-tf ${activeTimeframe === tf ? 'detail-tf--active' : ''}`}
                onClick={() => {
                  setActiveTimeframe(tf);
                  window.Telegram?.WebApp?.hapticFeedback?.selectionChanged();
                }}
              >
                {t(`detail.chart.${tf}`)}
              </button>
            ))}
          </div>
          <div className="detail-chart">
            <Line data={chartConfig} options={chartOptions} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="detail-actions">
          <button
            className="detail-btn detail-btn--primary"
            onClick={handleGetSignal}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <><span className="spinner-sm" /> Анализируем...</>
            ) : (
              t('detail.getSignal')
            )}
          </button>
          <button
            className="detail-btn detail-btn--secondary"
            onClick={handleNotifyOperator}
          >
            {t('detail.notifyOperator')}
          </button>
        </div>

        {/* Signal history */}
        {relatedSignals.length > 0 && (
          <div className="detail-history">
            <h3 className="detail-history__title">{t('detail.history')}</h3>
            {relatedSignals.map(signal => (
              <SignalCard key={signal.id} signal={signal} compact />
            ))}
          </div>
        )}

        <div style={{ height: 100 }} />
      </div>
    </div>
  );
}
