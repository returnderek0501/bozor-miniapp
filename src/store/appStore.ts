import { create } from 'zustand';

interface AppState {
  language: 'ru' | 'uz';
  isLoading: boolean;
  showNotificationPopup: boolean;

  setLanguage: (lang: 'ru' | 'uz') => void;
  setLoading: (loading: boolean) => void;
  toggleNotificationPopup: () => void;
  closeNotificationPopup: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  language: 'uz',
  isLoading: false,
  showNotificationPopup: false,

  setLanguage: (lang) => set({ language: lang }),
  setLoading: (loading) => set({ isLoading: loading }),
  toggleNotificationPopup: () =>
    set((state) => ({ showNotificationPopup: !state.showNotificationPopup })),
  closeNotificationPopup: () => set({ showNotificationPopup: false }),
}));
