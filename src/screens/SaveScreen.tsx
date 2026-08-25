import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SavingsApi } from '../api/endpoints';
import { SimulatedBadge } from '../components/SimulatedBadge';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { env } from '../config/env';
import { colors, spacing } from '../theme/colors';

export default function SaveScreen() {
  const enabled = env.features.balanceSave;
  const q = useQuery({
    queryKey: ['savings-account'],
    queryFn: SavingsApi.getAccount,
    enabled,
  });

  if (!enabled) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Save</Text>
        <Text style={styles.body}>
          Balance Save is off until a legal opinion clears the FAIS / NCA / Banks Act position. It is
          not available in production.
        </Text>
      </ScrollView>
    );
  }

  if (q.isLoading) return <LoadingState />;
  if (q.error) {
    return <ErrorState message="We couldn’t load Save." onRetry={() => q.refetch()} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SimulatedBadge note="no banking partner is contracted and no funds are held" />
      <Text style={styles.title}>Save</Text>
      <Card style={styles.card}>
        <Text style={styles.body}>{JSON.stringify(q.data ?? {}, null, 2)}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontSize: 20, fontWeight: '700', color: colors.navy, marginBottom: spacing.lg },
  card: { padding: spacing.md },
  body: { color: colors.text, fontSize: 13 },
});
