import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../../components/Header/Header';
import { useUserStore } from '../../store/userStore';
import './PortfolioScreen.css';

export function PortfolioScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { portfolio } = useUserStore();

  const totalValue = portfolio.reduce((sum, a) => sum + a.value, 0);
  const totalPnl = portfolio.reduce((sum, a) => sum + a.pnl, 0);
  const totalPnlPct = (totalPnl / (totalValue - totalPnl)) * 100;

  return (
    <div className="portfolio-screen">
      <Header title={t('portfolio.title')} onBack={() => navigate(-1)} />

      <div className="portfolio-body">
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

        <h3 className="portfolio-section-title">{t('portfolio.assets')}</h3>
        <div className="portfolio-assets">
          {portfolio.map(asset => (
            <button
              key={asset.symbol}
              className="portfolio-asset"
              onClick={() => navigate(`/instrument/${asset.symbol.toLowerCase()}`)}
            >
              <div className="portfolio-asset__icon">{asset.emoji}</div>
              <div className="portfolio-asset__info">
                <div className="portfolio-asset__symbol">{asset.symbol}</div>
                <div className="portfolio-asset__amount">{asset.amount} {t('portfolio.units')}</div>
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
