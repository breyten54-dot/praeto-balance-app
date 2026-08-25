import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { tokenStore } from '../api/client';
import { useAppStore } from '../context/appStore';
import { env } from '../config/env';
import { colors, radius, spacing } from '../theme/colors';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const user = useAppStore((s) => s.user);
  const reset = useAppStore((s) => s.reset);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.body}>
        {user?.firstName} {user?.lastName}
      </Text>
      <Text style={styles.muted}>{user?.email}</Text>
      {env.features.riskProfileModule ? (
        <Pressable style={styles.btn} onPress={() => navigation.navigate('RiskProfile')}>
          <Text style={styles.btnText}>Know Your Risk</Text>
        </Pressable>
      ) : null}
      {env.features.coachingBooking ? (
        <Pressable style={styles.btn} onPress={() => navigation.navigate('CoachingBooking')}>
          <Text style={styles.btnText}>Book a session</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={[styles.btn, styles.out]}
        onPress={async () => {
          await tokenStore.clearTokens();
          reset();
          setAuthenticated(false);
        }}
      >
        <Text style={styles.outText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontSize: 20, fontWeight: '700', color: colors.navy, marginBottom: spacing.md },
  body: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, marginBottom: spacing.lg },
  btn: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    padding: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  btnText: { color: colors.white, fontWeight: '700' },
  out: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.risk },
  outText: { color: colors.risk, fontWeight: '700' },
});
