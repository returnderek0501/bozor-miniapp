import { create } from 'zustand';
import type { Notification } from '../types';
import {
  fetchProfile, markNotifRead, markAllNotifsRead,
  defaultProfile, defaultPortfolio, type UserProfile, type PortfolioAsset,
} from '../api/client';

interface UserState {
  profile: UserProfile;
  portfolio: PortfolioAsset[];
  loaded: boolean;

  loadProfile: () => Promise<void>;
  setNotifications: (notifications: Notification[]) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: defaultProfile,
  portfolio: defaultPortfolio,
  loaded: false,

  loadProfile: async () => {
    const data = await fetchProfile();
    if (data) {
      set({
        profile: data,
        portfolio: data.portfolio || defaultPortfolio,
        loaded: true,
      });
    } else {
      set({ loaded: true });
    }
  },

  setNotifications: (notifications) =>
    set((s) => ({ profile: { ...s.profile, notifications } })),

  markNotificationRead: async (id) => {
    const result = await markNotifRead(id);
    if (result) {
      set((s) => ({ profile: { ...s.profile, notifications: result } }));
    } else {
      const notifications = get().profile.notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      );
      set((s) => ({ profile: { ...s.profile, notifications } }));
    }
  },

  markAllRead: async () => {
    const result = await markAllNotifsRead();
    if (result) {
      set((s) => ({ profile: { ...s.profile, notifications: result } }));
    } else {
      const notifications = get().profile.notifications.map(n => ({ ...n, isRead: true }));
      set((s) => ({ profile: { ...s.profile, notifications } }));
    }
  },
}));
