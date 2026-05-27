import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../../components/Header/Header';
import './PortfolioScreen.css';

const portfolioAssets = [
  { symbol: 'BTC', name: 'Bitcoin', emoji: '₿', amount: 0.21, value: 14368.31, pnl: 842.10, pnlPct: 6.23 },
  { symbol: 'ETH', name: 'Ethereum', emoji: 'Ξ', amount: 1.85, value: 7107.89, pnl: -312.40, pnlPct: -4.21 },
  { symbol: 'AAPL', name: 'Apple', emoji: '🍎', amount: 10, value: 2135.00, pnl: 95.30, pnlPct: 4.67 },
  { symbol: 'NVDA', name: 'NVIDIA', emoji: '🎮', amount: 3, value: 2625.60, pnl: 124.80, pnlPct: 4.99 },
  { symbol: 'XAU', name: 'Золото', emoji: '🥇', amount: 0.1, value: 238.56, pnl: 8.30, pnlPct: 3.61 },
];

export function PortfolioScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const totalValue = portfolioAssets.reduce((sum, a) => sum + a.value, 0);
  const totalPnl = portfolioAssets.reduce((sum, a) => sum + a.pnl, 0);
  const totalPnlPct = (totalPnl / (totalValue - totalPnl)) * 100;

  return (
    <div className="portfolio-screen">
      <Header title={t('portfolio.title')} onBack={() => navigate(-1)} />

      <div className="portfolio-body">
        {/* Total balance */}
        <div className="portfolio-total-card">
          <div className="portfolio-total__label">{t('portfolio.total')}</div>
          <div className="portfolio-total__amount">
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="portfolio-total__pnl">
            <span className={totalPnl >= 0 ? 'positive' : 'negative'}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </span>
            <span className={`portfolio-pnl-pct ${totalPnl >= 0 ? 'positive' : 'negative'}`}>
              ({totalPnl >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%)
            </span>
            <span className="portfolio-pnl-period">{t('portfolio.pnl')}</span>
          </div>
        </div>

        {/* Assets */}
        <h3 className="portfolio-section-title">{t('portfolio.assets')}</h3>
        <div className="portfolio-assets">
          {portfolioAssets.map(asset => (
            <button
              key={asset.symbol}
              className="portfolio-asset"
              onClick={() => navigate(`/instrument/${asset.symbol.toLowerCase()}`)}
            >
              <div className="portfolio-asset__icon">{asset.emoji}</div>
              <div className="portfolio-asset__info">
                <div className="portfolio-asset__symbol">{asset.symbol}</div>
                <div className="portfolio-asset__amount">{asset.amount} шт.</div>
              </div>
              <div className="portfolio-asset__right">
                <div className="portfolio-asset__value">
                  ${asset.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={`portfolio-asset__pnl ${asset.pnl >= 0 ? 'positive' : 'negative'}`}>
                  {asset.pnl >= 0 ? '+' : ''}{asset.pnlPct.toFixed(2)}%
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ height: 30 }} />
      </div>
    </div>
  );
}
