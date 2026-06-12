function getInitData(): string {
  return window.Telegram?.WebApp?.initData || '';
}

function authHeaders(): HeadersInit {
  const initData = getInitData();
  return initData ? { Authorization: `tma ${initData}` } : {};
}

export interface AuthUser {
  id: number;
  name: string;
}

export interface AuthStatus {
  authorized: boolean;
  reason?: string;
  message?: string;
  phone?: string;
  user?: AuthUser;
}

export interface EmployeeProfile {
  fullName: string;
  position: string;
  department: string;
  tenure: string;
  employeeId: string;
  advanceBalance: number;
  phone: string;
  lastWithdrawal: {
    amount: number;
    card: string;
    at: string;
  } | null;
  kycStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  kycRejectionReason?: string;
  kycCanSubmit?: boolean;
  withdrawAllowed?: boolean;
}

export interface KycSubmitResult {
  success: boolean;
  message?: string;
  kycStatus?: string;
}

export interface WithdrawResult {
  success: boolean;
  message?: string;
  amount?: number;
  balance?: number;
  card?: string;
}

export async function checkAuthStatus(): Promise<AuthStatus> {
  const res = await fetch('/api/auth/status', { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { authorized: false, reason: data.reason || 'error' };
  }
  return res.json();
}

export async function verifyPhone(phone: string): Promise<AuthStatus> {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ phone }),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      authorized: false,
      reason: data.reason,
      message: data.message,
    };
  }
  return data;
}

export async function fetchCabinet(): Promise<EmployeeProfile> {
  const res = await fetch('/api/cabinet', { headers: authHeaders() });
  if (!res.ok) throw new Error('fetch_failed');
  return res.json();
}

export async function submitKyc(idCard: string, selfie: string): Promise<KycSubmitResult> {
  const res = await fetch('/api/kyc/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ idCard, selfie }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, message: data.message };
  }
  return data;
}

export async function requestWithdraw(cardNumber: string, amount?: number): Promise<WithdrawResult> {
  const res = await fetch('/api/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ cardNumber, amount }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, message: data.message };
  }
  return data;
}
