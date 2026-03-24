import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const instance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token
instance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

instance.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return instance(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().clearAuth();
        window.location.href = '/';
        return Promise.reject(error);
      }
      try {
        const data: any = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        useAuthStore.getState().setAccessToken(data.data.accessToken);
        processQueue(null, data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return instance(original);
      } catch (err) {
        processQueue(err, null);
        useAuthStore.getState().clearAuth();
        window.location.href = '/';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export const apiClient = {
  get: (url: string, params?: any) => instance.get(url, { params }),
  post: (url: string, data?: any) => instance.post(url, data),
  put: (url: string, data?: any) => instance.put(url, data),
  patch: (url: string, data?: any) => instance.patch(url, data),
  delete: (url: string) => instance.delete(url),
};
