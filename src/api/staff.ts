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
  needsDeskName?: boolean;
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
  tags: Array<{
    id: string;
    label: string;
    note?: string;
    assignedAt?: string | null;
    hasPhoto?: boolean;
    webPhotoAvailable?: boolean;
  }>;
  createdAt: string | null;
  updatedAt: string | null;
  profileComplete: boolean;
  telegramId: number | null;
  telegramUsername: string;
  telegramDisplayName: string;
  telegramLinked: boolean;
  telegramLinkedAt: string | null;
  telegramLastSeenAt: string | null;
  kycReviewedByName?: string;
  hasKycDocuments?: boolean;
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

export interface StaffTag {
  id: string;
  label: string;
  description?: string;
  scope?: 'global' | 'operator';
  ownerTelegramId?: number | null;
  discovered?: boolean;
  protected?: boolean;
  canDelete?: boolean;
}

export interface PendingBroadcast {
  id: string;
  text: string;
  createdBy: number;
  scope: string;
  status: string;
  operatorApprovals: number[];
  adminApproval: number | null;
  createdAt: string;
}

export function fetchStaffClient(clientId: string): Promise<{ client: StaffClient }> {
  return jsonRequest(`/api/staff/clients/${encodeURIComponent(clientId)}`);
}

export function createStaffClient(
  phone: string,
  operatorName: string,
): Promise<{ success: boolean; client: StaffClient }> {
  return jsonRequest('/api/staff/clients', {
    method: 'POST',
    body: JSON.stringify({ phone, operatorName }),
  });
}

export function updateStaffClient(
  clientId: string,
  fields: Partial<Pick<
    StaffClient,
    'fullName' | 'age' | 'maritalStatus' | 'employeeId' | 'advanceBalance'
  >>,
): Promise<{ success: boolean; client: StaffClient }> {
  return jsonRequest(`/api/staff/clients/${encodeURIComponent(clientId)}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}

export function changeStaffClientOperator(
  clientId: string,
  operatorName: string,
): Promise<{ success: boolean; client: StaffClient }> {
  return jsonRequest(`/api/staff/clients/${encodeURIComponent(clientId)}/operator`, {
    method: 'PATCH',
    body: JSON.stringify({ operatorName }),
  });
}

export function fetchStaffTags(): Promise<{ tags: StaffTag[] }> {
  return jsonRequest('/api/staff/tags');
}

export function createStaffTag(label: string): Promise<{ success: boolean; tag: StaffTag }> {
  return jsonRequest('/api/staff/tags', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export function deleteStaffTag(tagId: string): Promise<{ success: boolean }> {
  return jsonRequest(`/api/staff/tags/${encodeURIComponent(tagId)}`, { method: 'DELETE' });
}

export function assignClientTag(
  clientId: string,
  data: { tagId?: string; label?: string; note?: string; photo?: string },
): Promise<{ success: boolean; client: StaffClient }> {
  return jsonRequest(`/api/staff/clients/${encodeURIComponent(clientId)}/tags`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function removeClientTag(
  clientId: string,
  tagId: string,
): Promise<{ success: boolean; client: StaffClient }> {
  return jsonRequest(
    `/api/staff/clients/${encodeURIComponent(clientId)}/tags/${encodeURIComponent(tagId)}`,
    { method: 'DELETE' },
  );
}

export async function fetchClientTagPhoto(clientId: string, tagId: string): Promise<Blob> {
  const response = await fetch(
    `/api/staff/clients/${encodeURIComponent(clientId)}/tags/${encodeURIComponent(tagId)}/photo`,
    { headers: authHeaders() },
  );
  if (!response.ok) throw new Error('PHOTO_NOT_FOUND');
  return response.blob();
}

export function sendStaffClientMessage(
  clientId: string,
  text: string,
): Promise<{ success: boolean; result: { sent: number; failed: number; total: number } }> {
  return jsonRequest(`/api/staff/clients/${encodeURIComponent(clientId)}/message`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function fetchTodayClients(): Promise<{ clients: StaffClient[] }> {
  return jsonRequest('/api/staff/summaries/today');
}

export function fetchOperatorStats(): Promise<{
  operators: Array<{ name: string; clients: number; tags: Record<string, number> }>;
}> {
  return jsonRequest('/api/staff/summaries/operators');
}

export type StaffStatsRange = 'hour' | 'today' | 'day' | 'week' | 'month' | 'all';

export interface StaffStatsData {
  range: StaffStatsRange;
  since: string | null;
  generatedAt: string;
  totals: {
    clients: number;
    clientsCreated: number;
    tagAssignments: number;
    tagRemovals: number;
  };
  operators: Array<{
    name: string;
    clientsTotal: number;
    clientsCreated: number;
    tagAssignments: number;
    tagRemovals: number;
    tags: Record<string, number>;
  }>;
}

export function fetchStaffStats(range: StaffStatsRange): Promise<StaffStatsData> {
  return jsonRequest(`/api/staff/stats?range=${encodeURIComponent(range)}`);
}

export function createStaffBroadcast(
  scope: 'one' | 'mine' | 'all',
  text: string,
  clientId?: string,
): Promise<{ success: boolean; broadcast?: PendingBroadcast; result?: { total: number; sent: number; failed: number } }> {
  return jsonRequest('/api/staff/broadcasts', {
    method: 'POST',
    body: JSON.stringify({ scope, text, clientId }),
  });
}

export function fetchPendingBroadcasts(): Promise<{ broadcasts: PendingBroadcast[] }> {
  return jsonRequest('/api/staff/broadcasts/pending');
}

export function approveStaffBroadcast(
  broadcastId: string,
): Promise<{ success: boolean; broadcast: PendingBroadcast; result?: { total: number; sent: number; failed: number } }> {
  return jsonRequest(`/api/staff/broadcasts/${encodeURIComponent(broadcastId)}/approve`, {
    method: 'POST',
  });
}

export async function downloadStaffExport(): Promise<void> {
  const response = await fetch('/api/staff/export', { headers: authHeaders() });
  if (!response.ok) throw new Error('EXPORT_FAILED');
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'uztronix.xlsx';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export interface StaffOperator {
  id: string;
  name: string;
  telegramId: number | null;
}

export interface StaffAdmin {
  telegramId: number;
  env: boolean;
  current: boolean;
}

export function fetchStaffOperators(): Promise<{ operators: StaffOperator[] }> {
  return jsonRequest('/api/staff/operators');
}

export function addStaffOperator(
  telegramId: number,
): Promise<{ success: boolean; operator: StaffOperator }> {
  return jsonRequest('/api/staff/operators', {
    method: 'POST',
    body: JSON.stringify({ telegramId }),
  });
}

export function deleteStaffOperator(operatorId: string): Promise<{ success: boolean }> {
  return jsonRequest(`/api/staff/operators/${encodeURIComponent(operatorId)}`, { method: 'DELETE' });
}

export function fetchStaffAdmins(): Promise<{ admins: StaffAdmin[] }> {
  return jsonRequest('/api/staff/admins');
}

export function addStaffAdmin(
  telegramId: number,
): Promise<{ success: boolean; admin: StaffAdmin }> {
  return jsonRequest('/api/staff/admins', {
    method: 'POST',
    body: JSON.stringify({ telegramId }),
  });
}

export function deleteStaffAdmin(telegramId: number): Promise<{ success: boolean }> {
  return jsonRequest(`/api/staff/admins/${telegramId}`, { method: 'DELETE' });
}
