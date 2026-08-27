import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { LearnApi } from '../api/endpoints';
import { normalizeError } from '../api/client';
import { useAppStore } from '../context/appStore';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { LEARN_MODULES_FALLBACK } from '../content/learnModulesFallback';
import { colors, radius, spacing } from '../theme/colors';

export default function LearnScreen() {
  const lsm = useAppStore((s) => s.effectiveLsmBand());
  const q = useQuery({
    queryKey: ['learn-modules', lsm],
    queryFn: () => LearnApi.getModules(lsm),
  });
  if (q.isLoading) return <LoadingState />;

  const usingFallback = Boolean(q.error);
  const modules = usingFallback ? LEARN_MODULES_FALLBACK : (q.data ?? []);
  const apiMessage = q.error ? normalizeError(q.error).message : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Learn</Text>
      {usingFallback ? (
        <Card style={styles.banner}>
          <Text style={styles.bannerTitle}>Live catalog unavailable</Text>
          <Text style={styles.bannerBody}>
            Showing the bundled 12 modules. The API did not return a catalog
            {apiMessage ? ` (${apiMessage})` : ''}. Completing a module still needs the live API
            after migrate + seed. NRGP helpline 0800 006 008.
          </Text>
          <Pressable
            style={styles.retry}
            onPress={() => q.refetch()}
            accessibilityRole="button"
            accessibilityLabel="Try again to load live Learn modules"
          >
            <Text style={styles.retryText}>Try live catalog again</Text>
          </Pressable>
        </Card>
      ) : null}
      {modules.map((m: { id: string; title: string; bodyMarkdown?: string }) => (
        <Card key={m.id} style={styles.card}>
          <Text style={styles.modTitle}>{m.title}</Text>
          {m.bodyMarkdown ? (
            <Text style={styles.body} numberOfLines={8}>
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
  banner: { padding: spacing.md, marginBottom: spacing.md, backgroundColor: '#F4E8C8' },
  bannerTitle: { fontWeight: '700', color: colors.navy, marginBottom: 6 },
  bannerBody: { color: colors.text, fontSize: 13, lineHeight: 18, marginBottom: spacing.sm },
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  card: { padding: spacing.md, marginBottom: spacing.md },
  modTitle: { fontWeight: '700', color: colors.navy, marginBottom: 6 },
  body: { color: colors.text, fontSize: 13, lineHeight: 18 },
});
