import { create } from 'zustand';
import type { Signal, SignalStatus } from '../types';
import { signals as initialSignals } from '../data/signals';

interface SignalState {
  signals: Signal[];
  activeSignalId: string | null;
  showSignalDetail: boolean;
  showUrgentPopup: boolean;
  urgentSignalId: string | null;

  openSignalDetail: (id: string) => void;
  closeSignalDetail: () => void;
  openUrgentPopup: (id: string) => void;
  closeUrgentPopup: () => void;
  updateSignalStatus: (id: string, status: SignalStatus) => void;
  markSignalSeen: (id: string) => void;
  addGeneratedSignal: (signal: Signal) => void;
}

export const useSignalStore = create<SignalState>((set) => ({
  signals: initialSignals,
  activeSignalId: null,
  showSignalDetail: false,
  showUrgentPopup: false,
  urgentSignalId: null,

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
