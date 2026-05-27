import { create } from 'zustand';
import type { Notification } from '../types';

interface AppState {
  language: 'ru' | 'uz';
  isLoading: boolean;
  showNotificationPopup: boolean;
  notifications: Notification[];
  unreadCount: number;

  setLanguage: (lang: 'ru' | 'uz') => void;
  setLoading: (loading: boolean) => void;
  toggleNotificationPopup: () => void;
  closeNotificationPopup: () => void;
  markAllRead: () => void;
  markNotificationRead: (id: string) => void;
}

const initialNotifications: Notification[] = [
  {
    id: 'n1',
    title: '🚨 Срочный сигнал по Bitcoin!',
    body: 'BTC/USDT: ПОКУПАЙ СРОЧНО на уровне $68,420',
    type: 'urgent',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    signalId: 's1',
  },
  {
    id: 'n2',
    title: '📊 Новый сигнал: NVDA',
    body: 'NVIDIA: Сигнал покупки. Потенциал +8.5%',
    type: 'signal',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    signalId: 's6',
  },
  {
    id: 'n3',
    title: '⚡ TSLA: Срочная продажа',
    body: 'Tesla достигла зоны сопротивления. Продавай сейчас!',
    type: 'urgent',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    signalId: 's2',
  },
  {
    id: 'n4',
    title: '✅ Сигнал ETH выполнен',
    body: 'Ethereum достиг целевой отметки +9.3%',
    type: 'info',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 'n5',
    title: '📈 Рынок открылся',
    body: 'Рынки США открылись. BTC +2.8%, Gold +0.7%',
    type: 'info',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
];

export const useAppStore = create<AppState>((set) => ({
  language: 'ru',
  isLoading: false,
  showNotificationPopup: false,
  notifications: initialNotifications,
  unreadCount: initialNotifications.filter(n => !n.isRead).length,

  setLanguage: (lang) => set({ language: lang }),
  setLoading: (loading) => set({ isLoading: loading }),
  toggleNotificationPopup: () =>
    set((state) => ({ showNotificationPopup: !state.showNotificationPopup })),
  closeNotificationPopup: () => set({ showNotificationPopup: false }),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),
  markNotificationRead: (id) =>
    set((state) => {
      const updated = state.notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter(n => !n.isRead).length,
      };
    }),
}));
