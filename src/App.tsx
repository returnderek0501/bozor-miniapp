import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
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

const NO_BOTTOM_NAV_ROUTES = ['/instrument/', '/portfolio'];

export default function App() {
  const location = useLocation();
  const { isLoading } = useAppStore();

  const showBottomNav = !NO_BOTTOM_NAV_ROUTES.some(r => location.pathname.startsWith(r));

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  return (
    <div className="app">
      {/* Global loading overlay */}
      {isLoading && (
        <div className="app-loader">
          <div className="app-loader__spinner" />
          <span>Обновляем...</span>
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

      {/* Global popups */}
      <UrgentSignalPopup />
      <SignalDetailPopup />
      <NotificationPopup />
    </div>
  );
}
