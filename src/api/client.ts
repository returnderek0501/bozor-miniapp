import type { Notification } from '../types';

export interface UserProfile {
  telegramId: number;
  displayName: string;
  balance: number;
  balanceChangePct: number;
  totalSignals: number;
  successRate: number;
  memberSince: number;
  level: string;
  language: 'uz' | 'ru';
  signalIds: string[] | null;
  portfolio: PortfolioAsset[] | null;
  notifications: Notification[];
}

export interface PortfolioAsset {
  symbol: string;
  name: string;
  emoji: string;
  amount: number;
  value: number;
  pnl: number;
  pnlPct: number;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

function getInitData(): string {
  return window.Telegram?.WebApp?.initData || '';
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const initData = getInitData();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };
    if (initData) headers.Authorization = `tma ${initData}`;

    const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchProfile(): Promise<UserProfile | null> {
  return apiFetch<UserProfile>('/me');
}

export async function markNotifRead(id: string): Promise<Notification[] | null> {
  return apiFetch<Notification[]>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotifsRead(): Promise<Notification[] | null> {
  return apiFetch<Notification[]>('/notifications/read-all', { method: 'PATCH' });
}

export const defaultPortfolio: PortfolioAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin', emoji: '₿', amount: 0.21, value: 14368.31, pnl: 842.10, pnlPct: 6.23 },
  { symbol: 'ETH', name: 'Ethereum', emoji: 'Ξ', amount: 1.85, value: 7107.89, pnl: -312.40, pnlPct: -4.21 },
  { symbol: 'AAPL', name: 'Apple', emoji: '🍎', amount: 10, value: 2135.00, pnl: 95.30, pnlPct: 4.67 },
  { symbol: 'NVDA', name: 'NVIDIA', emoji: '🎮', amount: 3, value: 2625.60, pnl: 124.80, pnlPct: 4.99 },
  { symbol: 'XAU', name: 'Oltin', emoji: '🥇', amount: 0.1, value: 238.56, pnl: 8.30, pnlPct: 3.61 },
];

export const defaultProfile: UserProfile = {
  telegramId: 0,
  displayName: 'Investor',
  balance: 24850,
  balanceChangePct: 3.24,
  totalSignals: 10,
  successRate: 78,
  memberSince: 2024,
  level: 'Investor',
  language: 'uz',
  signalIds: null,
  portfolio: null,
  notifications: [
    {
      id: 'n1',
      title: '🚨 Bitcoin bo\'yicha shoshilinch signal!',
      body: 'BTC/USDT: $68,420 darajasida SHOSHILINCH SOTIB OLING',
      type: 'urgent',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      signalId: 's1',
    },
    {
      id: 'n2',
      title: '📊 Yangi signal: NVDA',
      body: 'NVIDIA: Sotib olish signali. Potensial +8.5%',
      type: 'signal',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      signalId: 's6',
    },
    {
      id: 'n3',
      title: '⚡ TSLA: Shoshilinch sotish',
      body: 'Tesla qarshilik zonasiga yetdi. Hozir soting!',
      type: 'urgent',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      signalId: 's2',
    },
  ],
};
