import { create } from 'zustand';
import type { UserProfile } from '../api/types';

type AppState = {
  user: UserProfile | null;
  isPremium: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  setUser: (user: UserProfile | null) => void;
  setPremium: (isPremium: boolean) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setOnboardingComplete: (done: boolean) => void;
  effectiveLsmBand: () => string;
  reset: () => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  isPremium: false,
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  setUser: (user) => set({ user }),
  setPremium: (isPremium) => set({ isPremium }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setOnboardingComplete: (hasCompletedOnboarding) => set({ hasCompletedOnboarding }),
  effectiveLsmBand: () => get().user?.lsmBand ?? 'lsm_4_6',
  reset: () => set({ user: null, isPremium: false, isAuthenticated: false }),
}));
