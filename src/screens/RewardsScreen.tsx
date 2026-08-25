import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { RewardsApi } from '../api/endpoints';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { colors, spacing } from '../theme/colors';

export default function RewardsScreen() {
  const q = useQuery({ queryKey: ['rewards-summary'], queryFn: RewardsApi.getSummary });
  if (q.isLoading) return <LoadingState />;
  if (q.error) {
    return <ErrorState message="We couldn’t load Rewards." onRetry={() => q.refetch()} />;
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Rewards</Text>
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
