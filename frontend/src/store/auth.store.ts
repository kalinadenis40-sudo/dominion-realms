import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User { id: string; email: string; role: string; }
interface Profile { id: string; nickname: string; avatar_url?: string; }

interface AuthState {
  user: User | null;
  profile: Profile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, profile: Profile, access: string, refresh: string) => void;
  clearAuth: () => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, profile, accessToken, refreshToken) =>
        set({ user, profile, accessToken, refreshToken, isAuthenticated: true }),
      clearAuth: () =>
        set({ user: null, profile: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
      setAccessToken: (token) => set({ accessToken: token }),
    }),
    { name: 'dominion-auth', partialize: (s) => ({ user: s.user, profile: s.profile, refreshToken: s.refreshToken }) }
  )
);
