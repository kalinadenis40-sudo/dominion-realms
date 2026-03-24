import { create } from 'zustand';
import { apiClient } from '@/lib/api';

interface DashboardState {
  data: any | null;
  loading: boolean;
  error: string | null;
  fetchDashboard: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetchDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiClient.get('/dashboard') as any;
      set({ data, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Ошибка загрузки', loading: false });
    }
  },
}));
