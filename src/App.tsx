import { useEffect, useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { checkAuthStatus, verifyPhone } from './api/client';
import { AuthGate } from './screens/AuthGate/AuthGate';
import { AccessDenied } from './screens/AccessDenied/AccessDenied';
import { CabinetScreen } from './screens/CabinetScreen/CabinetScreen';
import { DocumentsScreen } from './screens/DocumentsScreen/DocumentsScreen';
import { BottomNav } from './components/BottomNav/BottomNav';
import { Header } from './components/Header/Header';
import { ThemeToggle } from './components/ThemeToggle/ThemeToggle';
import { checkStaffStatus, lockStaff } from './api/staff';
import { StaffGate } from './screens/StaffGate/StaffGate';
import { StaffDashboard } from './screens/StaffDashboard/StaffDashboard';

type AppState = 'loading' | 'staff-auth' | 'staff-ready' | 'auth' | 'denied' | 'ready';

export default function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
    let active = true;
    void checkStaffStatus()
      .then(async staffStatus => {
        if (!active) return;
        if (staffStatus.staff) {
          setState(staffStatus.unlocked ? 'staff-ready' : 'staff-auth');
          return;
        }
        const clientStatus = await checkAuthStatus();
        if (active) setState(clientStatus.authorized ? 'ready' : 'auth');
      })
      .catch(() => {
        if (active) setState('auth');
      });
    return () => { active = false; };
  }, []);

  const handleVerify = useCallback(async (phone: string) => {
    const result = await verifyPhone(phone);
    if (result.authorized) {
      setState('ready');
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } else if (result.reason === 'invalid_init_data') {
      setErrorMessage(t('error.contactFailed'));
      setState('denied');
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    } else {
      setErrorMessage(t('error.simDetail'));
      setState('denied');
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    }
  }, [t]);

  const handleStaffLogout = useCallback(() => {
    void lockStaff().finally(() => setState('staff-auth'));
  }, []);

  if (state === 'loading') {
    return (
      <div className="app-loader">
        <div className="top-bar">
          <ThemeToggle />
        </div>
        <div className="app-loader__spinner" />
        <span>{t('auth.loading')}</span>
      </div>
    );
  }

  if (state === 'auth') {
    return <AuthGate onVerify={handleVerify} />;
  }

  if (state === 'staff-auth') {
    return <StaffGate onUnlocked={() => setState('staff-ready')} />;
  }

  if (state === 'staff-ready') {
    return <StaffDashboard onLogout={handleStaffLogout} />;
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
          <Route path="/" element={<CabinetScreen />} />
          <Route path="/documents" element={<DocumentsScreen />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}
