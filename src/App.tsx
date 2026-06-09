import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { BottomNav } from './components/BottomNav/BottomNav';
import { UrgentSignalPopup } from './components/UrgentSignalPopup/UrgentSignalPopup';
import { SignalDetailPopup } from './components/SignalDetailPopup/SignalDetailPopup';
import { NotificationPopup } from './components/NotificationPopup/NotificationPopup';
import { HomeScreen } from './screens/HomeScreen/HomeScreen';
import { MarketsScreen } from './screens/MarketsScreen/MarketsScreen';
import { InstrumentDetailScreen } from './screens/InstrumentDetailScreen/InstrumentDetailScreen';
import { SignalsScreen } from './screens/SignalsScreen/SignalsScreen';
import { ProfileScreen } from './screens/ProfileScreen/ProfileScreen';
import { PortfolioScreen } from './screens/PortfolioScreen/PortfolioScreen';
import { useAppStore } from './store/appStore';
import { useUserStore } from './store/userStore';
import { useSignalStore } from './store/signalStore';

const NO_BOTTOM_NAV_ROUTES = ['/instrument/', '/portfolio'];

export default function App() {
  const location = useLocation();
  const { t } = useTranslation();
  const { isLoading, setLanguage } = useAppStore();
  const { loadProfile, profile } = useUserStore();
  const { setVisibleIds } = useSignalStore();

  const showBottomNav = !NO_BOTTOM_NAV_ROUTES.some(r => location.pathname.startsWith(r));

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
    loadProfile();
    const interval = setInterval(loadProfile, 60000);
    return () => clearInterval(interval);
  }, [loadProfile]);

  useEffect(() => {
    if (profile.language) {
      setLanguage(profile.language);
      i18n.changeLanguage(profile.language);
    }
    setVisibleIds(profile.signalIds);
  }, [profile.language, profile.signalIds, setLanguage, setVisibleIds]);

  return (
    <div className="app">
      {isLoading && (
        <div className="app-loader">
          <div className="app-loader__spinner" />
          <span>{t('home.refreshing')}</span>
        </div>
      )}

      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/markets" element={<MarketsScreen />} />
        <Route path="/instrument/:id" element={<InstrumentDetailScreen />} />
        <Route path="/signals" element={<SignalsScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/portfolio" element={<PortfolioScreen />} />
      </Routes>

      {showBottomNav && <BottomNav />}

      <UrgentSignalPopup />
      <SignalDetailPopup />
      <NotificationPopup />
    </div>
  );
}
