import { useEffect, useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  checkAuthStatus, submitKyc, verifyPhone, type AuthStatus,
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
import { checkStaffStatus, lockStaff } from './api/staff';
import { StaffGate } from './screens/StaffGate/StaffGate';
import { StaffDashboard } from './screens/StaffDashboard/StaffDashboard';

type AppState = 'loading' | 'staff-auth' | 'staff-ready' | 'kyc'
  | 'kyc-pending' | 'auth' | 'denied' | 'ready';

export default function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [kycRejected, setKycRejected] = useState(false);
  const [stagedKyc, setStagedKyc] = useState<KycOnboardingPayload | null>(null);
  const [checkingKyc, setCheckingKyc] = useState(false);

  const applyClientStatus = useCallback((status: AuthStatus) => {
    if (!status.authorized) {
      setPhoneVerified(false);
      setKycRejected(false);
      setState('kyc');
      return;
    }
    setPhoneVerified(true);
    if (status.appAllowed || status.kycStatus === 'approved') {
      setKycRejected(false);
      setState('ready');
    } else if (status.kycStatus === 'pending') {
      setState('kyc-pending');
    } else {
      setKycRejected(status.kycStatus === 'rejected');
      setState('kyc');
    }
  }, []);

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
        if (!active) return;
        if (clientStatus.reason === 'invalid_init_data') {
          setErrorMessage(t('error.contactFailed'));
          setState('denied');
        } else {
          applyClientStatus(clientStatus);
        }
      })
      .catch(() => {
        if (active) setState('kyc');
      });
    return () => { active = false; };
  }, [applyClientStatus, t]);

  const submitCapturedKyc = useCallback(async (payload: KycOnboardingPayload) => {
    const result = await submitKyc(payload.idCardFront, payload.idCardBack, payload.selfie);
    if (!result.success) throw new Error(result.error || 'KYC_SUBMIT_FAILED');
    setStagedKyc(null);
    setKycRejected(false);
    setState('kyc-pending');
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  }, []);

  const handleKycComplete = useCallback(async (payload: KycOnboardingPayload) => {
    if (!phoneVerified) {
      setStagedKyc(payload);
      setState('auth');
      return;
    }
    await submitCapturedKyc(payload);
  }, [phoneVerified, submitCapturedKyc]);

  const handleVerify = useCallback(async (phone: string) => {
    const result = await verifyPhone(phone);
    if (result.authorized) {
      setPhoneVerified(true);
      if (stagedKyc) {
        await submitCapturedKyc(stagedKyc);
      } else {
        applyClientStatus(result);
      }
    } else if (result.reason === 'invalid_init_data') {
      setErrorMessage(t('error.contactFailed'));
      setState('denied');
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    } else {
      setErrorMessage(t('error.simDetail'));
      setState('denied');
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    }
  }, [applyClientStatus, stagedKyc, submitCapturedKyc, t]);

  const refreshKycStatus = useCallback(async () => {
    setCheckingKyc(true);
    try {
      applyClientStatus(await checkAuthStatus());
    } finally {
      setCheckingKyc(false);
    }
  }, [applyClientStatus]);

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
    return <AuthGate onVerify={handleVerify} skipWelcome />;
  }

  if (state === 'kyc') {
    return (
      <KycOnboardingGate
        rejected={kycRejected}
        phoneAlreadyVerified={phoneVerified}
        onComplete={handleKycComplete}
      />
    );
  }

  if (state === 'kyc-pending') {
    return <KycPendingGate checking={checkingKyc} onRefresh={refreshKycStatus} />;
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
          setState(stagedKyc ? 'auth' : 'kyc');
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
