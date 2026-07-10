function authHeaders(): HeadersInit {
  const initData = window.Telegram?.WebApp?.initData || '';
  return initData ? { Authorization: `tma ${initData}` } : {};
}

async function jsonRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'REQUEST_FAILED');
    error.name = String(response.status);
    throw error;
  }
  return data;
}

export interface StaffProfile {
  staff: boolean;
  unlocked: boolean;
  role?: 'admin' | 'operator';
  name?: string;
  deskName?: string;
  recentDeskNames?: string[];
}

export interface StaffClient {
  clientId: string;
  fullName: string;
  phone: string;
  operator: string;
  age: number | string;
  maritalStatus: string;
  employeeId: string;
  advanceBalance: number;
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected';
  kycSubmittedAt: string | null;
  kycReviewedAt: string | null;
  kycRejectionReason: string;
  tags: Array<{ id: string; label: string }>;
  createdAt: string | null;
  profileComplete: boolean;
}

export interface StaffDashboardData {
  profile: StaffProfile;
  stats: {
    clients: number;
    pendingKyc: number;
    incomplete: number;
    approvedKyc: number;
  };
  clients: StaffClient[];
}

export async function checkStaffStatus(): Promise<StaffProfile> {
  const response = await fetch('/api/staff/status', { headers: authHeaders() });
  if (!response.ok) return { staff: false, unlocked: false };
  return response.json();
}

export function unlockStaff(code: string): Promise<StaffProfile & { success: boolean }> {
  return jsonRequest('/api/staff/unlock', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function lockStaff(): Promise<{ success: boolean }> {
  return jsonRequest('/api/staff/lock', { method: 'POST' });
}

export function fetchStaffDashboard(): Promise<StaffDashboardData> {
  return jsonRequest('/api/staff/dashboard');
}

export function selectDeskOperator(name: string): Promise<{ success: boolean; deskName: string }> {
  return jsonRequest('/api/staff/desk', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function fetchKycDocument(
  clientId: string,
  documentType: 'idCardFront' | 'idCardBack' | 'selfie',
): Promise<Blob> {
  const response = await fetch(
    `/api/staff/kyc/${encodeURIComponent(clientId)}/documents/${documentType}`,
    { headers: authHeaders() },
  );
  if (!response.ok) throw new Error('DOCUMENT_NOT_FOUND');
  return response.blob();
}

export function reviewKyc(
  clientId: string,
  decision: 'approved' | 'rejected',
  reason = '',
): Promise<{ success: boolean; client: StaffClient }> {
  return jsonRequest(`/api/staff/kyc/${encodeURIComponent(clientId)}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
  });
}
