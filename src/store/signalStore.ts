import { create } from 'zustand';
import type { Signal, SignalStatus } from '../types';
import { signals as initialSignals } from '../data/signals';

interface SignalState {
  signals: Signal[];
  visibleIds: string[] | null;
  activeSignalId: string | null;
  showSignalDetail: boolean;
  showUrgentPopup: boolean;
  urgentSignalId: string | null;

  setVisibleIds: (ids: string[] | null) => void;
  getVisibleSignals: () => Signal[];
  openSignalDetail: (id: string) => void;
  closeSignalDetail: () => void;
  openUrgentPopup: (id: string) => void;
  closeUrgentPopup: () => void;
  updateSignalStatus: (id: string, status: SignalStatus) => void;
  markSignalSeen: (id: string) => void;
  addGeneratedSignal: (signal: Signal) => void;
}

export const useSignalStore = create<SignalState>((set, get) => ({
  signals: initialSignals,
  visibleIds: null,
  activeSignalId: null,
  showSignalDetail: false,
  showUrgentPopup: false,
  urgentSignalId: null,

  setVisibleIds: (ids) => set({ visibleIds: ids }),

  getVisibleSignals: () => {
    const { signals, visibleIds } = get();
    if (!visibleIds) return signals;
    return signals.filter(s => visibleIds.includes(s.id));
  },

  openSignalDetail: (id) =>
    set((state) => {
      const signal = state.signals.find(s => s.id === id);
      if (signal?.isUrgent) {
        return { showUrgentPopup: true, urgentSignalId: id, activeSignalId: id };
      }
      return { showSignalDetail: true, activeSignalId: id };
    }),

  closeSignalDetail: () =>
    set({ showSignalDetail: false, activeSignalId: null }),

  openUrgentPopup: (id) =>
    set({ showUrgentPopup: true, urgentSignalId: id, activeSignalId: id }),

  closeUrgentPopup: () =>
    set({ showUrgentPopup: false, urgentSignalId: null }),

  updateSignalStatus: (id, status) =>
    set((state) => ({
      signals: state.signals.map(s => s.id === id ? { ...s, status } : s),
    })),

  markSignalSeen: (id) =>
    set((state) => ({
      signals: state.signals.map(s =>
        s.id === id && s.status === 'new' ? { ...s, status: 'seen' } : s
      ),
    })),

  addGeneratedSignal: (signal) =>
    set((state) => ({ signals: [signal, ...state.signals] })),
}));
