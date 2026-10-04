import { create } from 'zustand';
import type { DataProfile, Filters } from '../types';

interface AppState {
  profile: DataProfile | null;
  filters: Filters;
  setProfile: (profile: DataProfile) => void;
  setFilters: (filters: Partial<Filters>) => void;
  reset: () => void;
}

const emptyFilters: Filters = {
  startDate: '',
  endDate: '',
  artist: '',
  album: '',
  yearMonth: '',
  minSeconds: 30,
};

export const useAppStore = create<AppState>((set) => ({
  profile: null,
  filters: emptyFilters,
  setProfile: (profile) => set({
    profile,
    filters: { ...emptyFilters, startDate: profile.minDate, endDate: profile.maxDate },
  }),
  setFilters: (next) => set((state) => ({ filters: { ...state.filters, ...next } })),
  reset: () => set({ profile: null, filters: emptyFilters }),
}));
