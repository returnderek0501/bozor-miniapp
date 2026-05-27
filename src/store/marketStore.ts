import { create } from 'zustand';
import type { Instrument } from '../types';
import { instruments as initialInstruments } from '../data/instruments';

type MarketCategory = 'all' | 'crypto' | 'stocks' | 'forex' | 'commodities';

interface MarketState {
  instruments: Instrument[];
  activeCategory: MarketCategory;
  searchQuery: string;
  lastUpdated: Date;
  isRefreshing: boolean;

  setCategory: (cat: MarketCategory) => void;
  setSearchQuery: (q: string) => void;
  refreshMarket: () => Promise<void>;
  getFilteredInstruments: () => Instrument[];
}

export const useMarketStore = create<MarketState>((set, get) => ({
  instruments: initialInstruments,
  activeCategory: 'all',
  searchQuery: '',
  lastUpdated: new Date(),
  isRefreshing: false,

  setCategory: (cat) => set({ activeCategory: cat }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  refreshMarket: async () => {
    set({ isRefreshing: true });
    await new Promise(r => setTimeout(r, 1200));
    // Simulate price updates
    set((state) => ({
      instruments: state.instruments.map(inst => ({
        ...inst,
        price: inst.price * (1 + (Math.random() - 0.5) * 0.008),
        changePercent24h: inst.changePercent24h + (Math.random() - 0.5) * 0.3,
      })),
      lastUpdated: new Date(),
      isRefreshing: false,
    }));
  },

  getFilteredInstruments: () => {
    const { instruments, activeCategory, searchQuery } = get();
    return instruments.filter(inst => {
      const matchesCategory = activeCategory === 'all' || inst.category === activeCategory;
      const matchesSearch = !searchQuery ||
        inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  },
}));
