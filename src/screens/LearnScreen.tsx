import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { LearnApi } from '../api/endpoints';
import { useAppStore } from '../context/appStore';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { colors, spacing } from '../theme/colors';

export default function LearnScreen() {
  const lsm = useAppStore((s) => s.effectiveLsmBand());
  const q = useQuery({
    queryKey: ['learn-modules', lsm],
    queryFn: () => LearnApi.getModules(lsm),
  });
  if (q.isLoading) return <LoadingState />;
  if (q.error) {
    return (
      <ErrorState message="We couldn’t load Learn modules." onRetry={() => q.refetch()} />
    );
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Learn</Text>
      {(q.data ?? []).map((m: { id: string; title: string; bodyMarkdown?: string }) => (
        <Card key={m.id} style={styles.card}>
          <Text style={styles.modTitle}>{m.title}</Text>
          {m.bodyMarkdown ? (
            <Text style={styles.body} numberOfLines={6}>
              {m.bodyMarkdown}
            </Text>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontSize: 20, fontWeight: '700', color: colors.navy, marginBottom: spacing.lg },
  card: { padding: spacing.md, marginBottom: spacing.md },
  modTitle: { fontWeight: '700', color: colors.navy, marginBottom: 6 },
  body: { color: colors.text, fontSize: 13, lineHeight: 18 },
});
