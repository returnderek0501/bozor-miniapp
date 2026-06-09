import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../../components/Header/Header';
import { SignalCard } from '../../components/SignalCard/SignalCard';
import { InstrumentCard } from '../../components/InstrumentCard/InstrumentCard';
import { useSignalStore } from '../../store/signalStore';
import { useMarketStore } from '../../store/marketStore';
import { useAppStore } from '../../store/appStore';
import { useUserStore } from '../../store/userStore';
import { getFeaturedInstruments } from '../../data/instruments';
import './HomeScreen.css';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getVisibleSignals } = useSignalStore();
  const { refreshMarket, isRefreshing } = useMarketStore();
  const { setLoading } = useAppStore();
  const { profile } = useUserStore();
  const [isPulling, setIsPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [showInAppNotif, setShowInAppNotif] = useState(false);

  const signals = getVisibleSignals();
  const featured = getFeaturedInstruments();
  const recommendations = signals.slice(0, 5);

  useEffect(() => {
    const timer = setTimeout(() => setShowInAppNotif(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.currentTarget as HTMLElement).scrollTop === 0) {
      setTouchStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientY - touchStartY;
    if (diff > 0 && (e.currentTarget as HTMLElement).scrollTop === 0) {
      setPullY(Math.min(diff * 0.4, 80));
      setIsPulling(true);
    }
  };

  const handleTouchEnd = useCallback(async () => {
    if (pullY > 50) {
      setLoading(true);
      await refreshMarket();
      setLoading(false);
      window.Telegram?.WebApp?.hapticFeedback?.notificationOccurred('success');
    }
    setIsPulling(false);
    setPullY(0);
  }, [pullY, refreshMarket, setLoading]);

  const handleRefreshBtn = async () => {
    setLoading(true);
    window.Telegram?.WebApp?.hapticFeedback?.impactOccurred('medium');
    await refreshMarket();
    setLoading(false);
  };

  return (
    <div className="home-screen">
      <Header showLang showNotif />

      {showInAppNotif && (
        <div className="home-inapp-notif" onClick={() => setShowInAppNotif(false)}>
          <span>{t('home.urgentNotif')}</span>
          <button onClick={() => setShowInAppNotif(false)}>✕</button>
        </div>
      )}

      <div
        className="home-scroll"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: isPulling ? `translateY(${pullY}px)` : undefined, transition: isPulling ? 'none' : 'transform 0.3s ease' }}
      >
        {isPulling && pullY > 20 && (
          <div className="home-pull-indicator" style={{ opacity: Math.min(pullY / 50, 1) }}>
            {pullY > 50 ? t('home.pullRelease') : t('home.pullDown')}
          </div>
        )}

        {isRefreshing && (
          <div className="home-refreshing">
            <div className="spinner" />
            <span>{t('home.refreshing')}</span>
          </div>
        )}

        <div className="home-section">
          <button className="balance-card" onClick={() => navigate('/portfolio')}>
            <div className="balance-card__top">
              <span className="balance-card__label">{t('home.balance')}</span>
              <span className="balance-card__portfolio">{t('home.portfolio')}</span>
            </div>
            <div className="balance-card__amount">
              ${profile.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="balance-card__change">
              <span className="balance-card__badge">+{profile.balanceChangePct}%</span>
              <span className="balance-card__change-desc">{t('home.todayChange')}</span>
            </div>
          </button>
        </div>

        <div className="home-section">
          <h2 className="home-section__title">{t('home.today')}</h2>
          <div className="home-carousel">
            {featured.map(inst => (
              <InstrumentCard key={inst.id} instrument={inst} variant="carousel" />
            ))}
          </div>
        </div>

        <div className="home-section">
          <h2 className="home-section__title">{t('home.recommendations')}</h2>
          <div className="home-signals-list">
            {recommendations.map(signal => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>

          <button
            className="home-refresh-btn"
            onClick={handleRefreshBtn}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <><span className="spinner-sm" /> {t('home.refreshing')}</>
            ) : (
              t('home.refreshMarket')
            )}
          </button>
        </div>

        <div style={{ height: 90 }} />
      </div>
    </div>
  );
}
