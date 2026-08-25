import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { BalanceScoreApi, BudgetApi } from '../api/endpoints';
import { Card } from '../components/Card';
import { BudgetBar } from '../components/BudgetBar';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { useAppStore } from '../context/appStore';
import { env } from '../config/env';
import { formatRand } from '../utils/money';
import { colors, spacing } from '../theme/colors';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const user = useAppStore((s) => s.user);
  const scoreQ = useQuery({ queryKey: ['balance-score'], queryFn: BalanceScoreApi.getScore });
  const budgetQ = useQuery({ queryKey: ['budget-summary'], queryFn: () => BudgetApi.getSummary() });

  if (scoreQ.isLoading || budgetQ.isLoading) return <LoadingState />;
  if (scoreQ.error || budgetQ.error) {
    return (
      <ErrorState
        message="We couldn’t load your dashboard right now. The server may have been waking up — try again."
        onRetry={() => {
          scoreQ.refetch();
          budgetQ.refetch();
        }}
      />
    );
  }

  const gambling = budgetQ.data?.categories.find((c: { category: string }) => c.category === 'gambling');
  const over = Boolean(gambling && gambling.spentCents > gambling.limitCents);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning, {user?.firstName ?? ''}</Text>
        <Text style={styles.title}>Praeto Balance</Text>
      </View>
      <Card style={styles.scoreCard}>
        <Text style={styles.caption}>Balance score</Text>
        <Text style={styles.score}>{scoreQ.data?.score ?? '—'}</Text>
      </Card>
      {gambling ? (
        <Card style={styles.budgetCard}>
          <Text style={styles.caption}>Gambling this month</Text>
          <Text style={styles.spend}>
            {formatRand(gambling.spentCents)} / {formatRand(gambling.limitCents)}
          </Text>
          <BudgetBar spentCents={gambling.spentCents} limitCents={gambling.limitCents} />
          {over ? (
            <Text style={styles.over}>Over the gambling budget — open the Gambling tab.</Text>
          ) : null}
        </Card>
      ) : null}
      {env.features.riskProfileModule ? (
        <Pressable
          style={styles.cta}
          onPress={() => navigation.navigate('RiskProfile')}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Take the Know Your Risk assessment</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { marginBottom: spacing.lg },
  greeting: { color: colors.muted, fontSize: 13 },
  title: { color: colors.navy, fontSize: 24, fontWeight: '800' },
  scoreCard: { padding: spacing.lg, marginBottom: spacing.md },
  budgetCard: { padding: spacing.lg, marginBottom: spacing.md },
  caption: { color: colors.muted, fontSize: 11, textTransform: 'uppercase', fontWeight: '700' },
  score: { color: colors.navy, fontSize: 40, fontWeight: '800' },
  spend: { color: colors.text, fontWeight: '700', marginVertical: 6 },
  over: { color: colors.risk, marginTop: 8, fontSize: 12, fontWeight: '600' },
  cta: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ctaText: { color: colors.white, fontWeight: '700' },
});
