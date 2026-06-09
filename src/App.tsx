import { useEffect, useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { checkAuthStatus, verifyPhone, type AuthStatus } from './api/client';
import { AuthGate } from './screens/AuthGate/AuthGate';
import { AccessDenied } from './screens/AccessDenied/AccessDenied';
import { HomeScreen } from './screens/HomeScreen/HomeScreen';
import { ServicesScreen } from './screens/ServicesScreen/ServicesScreen';
import { ProfileScreen } from './screens/ProfileScreen/ProfileScreen';
import { BottomNav } from './components/BottomNav/BottomNav';
import { Header } from './components/Header/Header';

type AppState = 'loading' | 'auth' | 'denied' | 'ready';

export default function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>('loading');
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const refreshAuth = useCallback(async () => {
    const status = await checkAuthStatus();
    if (status.authorized) {
      setAuth(status);
      setState('ready');
      return status;
    }
    setState('auth');
    return status;
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
    refreshAuth();
  }, [refreshAuth]);

  const handleRequestContact = useCallback(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.requestContact) {
      setErrorMessage(t('error.contactFailed'));
      setState('denied');
      return;
    }

    setState('loading');
    tg.requestContact(async (sent, event) => {
      if (!sent || !event?.contact?.phone_number) {
        setErrorMessage(t('error.contactFailed'));
        setState('auth');
        return;
      }

      const result = await verifyPhone(event.contact.phone_number);
      if (result.authorized) {
        setAuth(result);
        setState('ready');
        tg.HapticFeedback?.impactOccurred('light');
      } else {
        setErrorMessage(result.message || t('error.simDetail'));
        setState('denied');
        tg.HapticFeedback?.impactOccurred('medium');
      }
    });
  }, [t]);

  if (state === 'loading') {
    return (
      <div className="app-loader">
        <div className="app-loader__spinner" />
        <span>{t('auth.loading')}</span>
      </div>
    );
  }

  if (state === 'auth') {
    return <AuthGate onRequestContact={handleRequestContact} />;
  }

  if (state === 'denied') {
    return (
      <AccessDenied
        message={errorMessage}
        onRetry={() => {
          setErrorMessage('');
          setState('auth');
        }}
      />
    );
  }

  return (
    <div className="app">
      <Header />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<HomeScreen userName={auth?.user?.name} />} />
          <Route path="/services" element={<ServicesScreen />} />
          <Route path="/profile" element={<ProfileScreen phone={auth?.phone} name={auth?.user?.name} />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}
