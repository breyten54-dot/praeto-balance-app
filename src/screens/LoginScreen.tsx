import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiClient, tokenStore } from '../api/client';
import { configureSubscriptions } from '../services/subscriptions';
import { useAppStore } from '../context/appStore';
import { colors, radius, spacing } from '../theme/colors';

export default function LoginScreen() {
  const setUser = useAppStore((s) => s.setUser);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const [email, setEmail] = useState('demo@praetobalance.co.za');
  const [password, setPassword] = useState('Demo1234!');
  const [busy, setBusy] = useState(false);

  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>Praeto Balance</Text>
      <Text style={styles.sub}>Sign in to your wellness account</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable
        style={styles.button}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            const { data } = await apiClient.post('/auth/login', { email, password });
            await tokenStore.setTokens(data.accessToken, data.refreshToken);
            setUser(data.user);
            await configureSubscriptions(data.user.id);
            setAuthenticated(true);
          } catch {
            Alert.alert('Login failed', 'Check your email and password and try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>Log in</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy, padding: spacing.xl, justifyContent: 'center' },
  brand: { color: colors.gold, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  sub: { color: colors.white, marginBottom: spacing.xl },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: spacing.md,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.navy, fontWeight: '800' },
});
