import { useEffect, useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  checkAuthStatus, checkOnboardingKycStatus, submitOnboardingKyc, verifyPhone,
} from './api/client';
import { AuthGate } from './screens/AuthGate/AuthGate';
import {
  KycOnboardingGate, KycPendingGate, type KycOnboardingPayload,
} from './screens/AuthGate/KycOnboardingGate';
import { AccessDenied } from './screens/AccessDenied/AccessDenied';
import { CabinetScreen } from './screens/CabinetScreen/CabinetScreen';
import { DocumentsScreen } from './screens/DocumentsScreen/DocumentsScreen';
import { BottomNav } from './components/BottomNav/BottomNav';
import { Header } from './components/Header/Header';
import { ThemeToggle } from './components/ThemeToggle/ThemeToggle';
import {
  checkBrowserStaffSession, checkStaffStatus, lockStaff, logoutBrowserAdmin,
} from './api/staff';
import { StaffGate } from './screens/StaffGate/StaffGate';
import { BrowserStaffGate } from './screens/StaffGate/BrowserStaffGate';
import { StaffDashboard } from './screens/StaffDashboard/StaffDashboard';
import { isBrowserAdminRoute } from './browserAdmin';

type AppState = 'loading' | 'staff-auth' | 'staff-ready' | 'browser-auth' | 'kyc'
  | 'kyc-pending' | 'auth' | 'denied' | 'ready';

export default function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [kycRejected, setKycRejected] = useState(false);
  const [checkingKyc, setCheckingKyc] = useState(false);
  const [browserMode] = useState(() => isBrowserAdminRoute());

  const resolveClientEntry = useCallback(async () => {
    const onboarding = await checkOnboardingKycStatus();
    if (onboarding.kycStatus === 'pending') {
      setKycRejected(false);
      setState('kyc-pending');
      return;
    }
    if (onboarding.kycStatus !== 'approved') {
      setKycRejected(onboarding.kycStatus === 'rejected');
      setState('kyc');
      return;
    }

    const auth = await checkAuthStatus();
    if (auth.authorized && (auth.appAllowed || auth.kycStatus === 'approved')) {
      setKycRejected(false);
      setState('ready');
    } else {
      setState('auth');
    }
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
    let active = true;

    void (async () => {
      if (browserMode) {
        try {
          const session = await checkBrowserStaffSession();
          if (!active) return;
          if (session.authenticated && session.unlocked) {
            setState('staff-ready');
            return;
          }
          setState('browser-auth');
        } catch {
          if (active) setState('browser-auth');
        }
        return;
      }

      try {
        const staffStatus = await checkStaffStatus();
        if (!active) return;
        if (staffStatus.staff) {
          setState(staffStatus.unlocked ? 'staff-ready' : 'staff-auth');
          return;
        }
        await resolveClientEntry();
      } catch {
        if (active) setState('kyc');
      }
    })();

    return () => { active = false; };
  }, [browserMode, resolveClientEntry]);

  const handleKycComplete = useCallback(async (payload: KycOnboardingPayload) => {
    const result = await submitOnboardingKyc(
      payload.idCardFront,
      payload.idCardBack,
      payload.selfie,
    );
    if (!result.success) throw new Error(result.error || 'KYC_SUBMIT_FAILED');
    setKycRejected(false);
    setState('kyc-pending');
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  }, []);

  const handleVerify = useCallback(async (phone: string) => {
    const result = await verifyPhone(phone);
    if (result.authorized && (result.appAllowed || result.kycStatus === 'approved')) {
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

  const refreshKycStatus = useCallback(async () => {
    setCheckingKyc(true);
    try {
      await resolveClientEntry();
    } finally {
      setCheckingKyc(false);
    }
  }, [resolveClientEntry]);

  const handleStaffLogout = useCallback(() => {
    if (browserMode) {
      void logoutBrowserAdmin().finally(() => setState('browser-auth'));
      return;
    }
    void lockStaff().finally(() => setState('staff-auth'));
  }, [browserMode]);

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
    return <AuthGate onVerify={handleVerify} skipWelcome />;
  }

  if (state === 'kyc') {
    return (
      <KycOnboardingGate
        rejected={kycRejected}
        onComplete={handleKycComplete}
      />
    );
  }

  if (state === 'kyc-pending') {
    return <KycPendingGate checking={checkingKyc} onRefresh={refreshKycStatus} />;
  }

  if (state === 'browser-auth') {
    return <BrowserStaffGate onUnlocked={() => setState('staff-ready')} />;
  }

  if (state === 'staff-auth') {
    return <StaffGate onUnlocked={() => setState('staff-ready')} />;
  }

  if (state === 'staff-ready') {
    return <StaffDashboard onLogout={handleStaffLogout} browserMode={browserMode} />;
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
