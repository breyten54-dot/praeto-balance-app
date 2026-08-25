import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { env } from '../config/env';
import type { ApiErrorBody } from './types';

const ACCESS = 'pb_access_token';
const REFRESH = 'pb_refresh_token';

async function webGet(key: string): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
}
async function webSet(key: string, value: string): Promise<void> {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value);
}
async function webDel(key: string): Promise<void> {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}

export const tokenStore = {
  async getAccessToken() {
    if (Platform.OS === 'web') return webGet(ACCESS);
    return SecureStore.getItemAsync(ACCESS);
  },
  async getRefreshToken() {
    if (Platform.OS === 'web') return webGet(REFRESH);
    return SecureStore.getItemAsync(REFRESH);
  },
  async setTokens(access: string, refresh: string) {
    if (Platform.OS === 'web') {
      await webSet(ACCESS, access);
      await webSet(REFRESH, refresh);
      return;
    }
    await SecureStore.setItemAsync(ACCESS, access);
    await SecureStore.setItemAsync(REFRESH, refresh);
  },
  async clearTokens() {
    if (Platform.OS === 'web') {
      await webDel(ACCESS);
      await webDel(REFRESH);
      return;
    }
    await SecureStore.deleteItemAsync(ACCESS);
    await SecureStore.deleteItemAsync(REFRESH);
  },
};

type ExpiredListener = () => void;
const expiredListeners = new Set<ExpiredListener>();

export const sessionEvents = {
  onExpired(fn: ExpiredListener) {
    expiredListeners.add(fn);
    return () => expiredListeners.delete(fn);
  },
  emitExpired() {
    expiredListeners.forEach((fn) => fn());
  },
};

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenStore.getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config;
    if (!original || error.response?.status !== 401 || (original as { _retry?: boolean })._retry) {
      if (error.response?.status === 401) {
        await tokenStore.clearTokens();
        sessionEvents.emitExpired();
      }
      return Promise.reject(error);
    }
    (original as { _retry?: boolean })._retry = true;
    if (!refreshing) {
      refreshing = (async () => {
        const refresh = await tokenStore.getRefreshToken();
        if (!refresh) return null;
        try {
          const { data } = await axios.post(`${env.apiBaseUrl}/auth/refresh`, { refreshToken: refresh });
          await tokenStore.setTokens(data.accessToken, data.refreshToken ?? refresh);
          return data.accessToken as string;
        } catch {
          await tokenStore.clearTokens();
          sessionEvents.emitExpired();
          return null;
        } finally {
          refreshing = null;
        }
      })();
    }
    const next = await refreshing;
    if (!next) return Promise.reject(error);
    original.headers = original.headers ?? {};
    original.headers.Authorization = `Bearer ${next}`;
    return apiClient(original);
  },
);

export function normalizeError(err: unknown): { code: string; message: string } {
  const ax = err as AxiosError<ApiErrorBody>;
  return {
    code: ax.response?.data?.code ?? 'UNKNOWN',
    message: ax.response?.data?.message ?? ax.message ?? 'Something went wrong.',
  };
}
