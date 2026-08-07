import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppNavigator from './src/navigation/AppNavigator';
import { sessionEvents, tokenStore } from './src/api/client';
import { useAppStore } from './src/context/appStore';
import { UserApi } from './src/api/endpoints';
import { configureSubscriptions } from './src/services/subscriptions';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60_000, // 1 minute — financial data shouldn't feel stale, but also shouldn't hammer the API on every tab switch
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setUser = useAppStore((s) => s.setUser);
  const reset = useAppStore((s) => s.reset);

  // Rehydrate session on cold start if a valid token is already stored.
  useEffect(() => {
    (async () => {
      const token = await tokenStore.getAccessToken();
      if (!token) return;
      try {
        const profile = await UserApi.getProfile();
        setUser(profile);
        await configureSubscriptions(profile.id);
        setAuthenticated(true);
      } catch {
        await tokenStore.clearTokens();
      }
    })();
  }, []);

  // If the API layer signals the refresh token is dead, drop back to login.
  useEffect(() => {
    const unsubscribe = sessionEvents.onExpired(() => {
      reset();
      setAuthenticated(false);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <AppNavigator />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
