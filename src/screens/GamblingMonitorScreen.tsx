import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GamblingApi } from '../api/endpoints';
import { normalizeError } from '../api/client';
import { Card } from '../components/Card';
import { BudgetBar } from '../components/BudgetBar';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { CrisisSupportCard } from '../components/CrisisSupportCard';
import { SelfExclusionCard } from '../components/SelfExclusionCard';
import { formatRand } from '../utils/money';
import { colors, radius, spacing } from '../theme/colors';

export default function GamblingMonitorScreen() {
  const queryClient = useQueryClient();
  const summaryQ = useQuery({
    queryKey: ['gambling-summary'],
    queryFn: GamblingApi.getSpendSummary,
  });
  const alertMut = useMutation({
    mutationFn: (enabled: boolean) => GamblingApi.toggleDailyAlert(enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gambling-summary'] }),
  });
  const coolMut = useMutation({
    mutationFn: () => GamblingApi.requestCoolingOffPeriod(30),
    onSuccess: () =>
      Alert.alert(
        'Cooling-off requested',
        'Your 30-day cooling-off period has been submitted. This cannot be reversed early.',
      ),
    onError: (err) => {
      const { code, message } = normalizeError(err);
      if (code === 'COOLING_OFF_ACTIVE') {
        Alert.alert('Cooling-off already active', message);
        return;
      }
      Alert.alert('Could not start cooling-off', message);
    },
  });

  if (summaryQ.isLoading) return <LoadingState />;
  if (summaryQ.error) {
    return (
      <ErrorState
        message="We couldn’t load your gambling spending summary. Tap Try again or pull down to refresh."
        onRetry={() => summaryQ.refetch()}
      />
    );
  }

  const data = summaryQ.data;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <CrisisSupportCard />
      <SelfExclusionCard />
      <Text style={styles.title}>Spending monitor</Text>
      {data ? (
        <Card style={[styles.summaryCard, data.isOverLimit && styles.summaryCardOver]}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryAmount}>{formatRand(data.spentCents)}</Text>
              <Text style={styles.summaryLabel}>spent this month</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.summaryLimit}>{formatRand(data.limitCents)}</Text>
              <Text style={styles.summaryLabel}>your limit</Text>
            </View>
          </View>
          <BudgetBar spentCents={data.spentCents} limitCents={data.limitCents} />
          {data.isOverLimit ? (
            <Text style={styles.overLimitText}>Over budget — consider a cooling-off period below.</Text>
          ) : null}
        </Card>
      ) : null}
      <Text style={styles.sectionTitle}>Transactions this month</Text>
      <Card>
        {data?.transactions.map((tx: { id: string; merchant: string; date: string; category: string; amountCents: number }, i: number) => (
          <View
            key={tx.id}
            style={[styles.txRow, i < data.transactions.length - 1 && styles.txRowBorder]}
          >
            <View>
              <Text style={styles.txMerchant}>{tx.merchant}</Text>
              <Text style={styles.txDate}>
                {tx.date} · {tx.category}
              </Text>
            </View>
            <Text style={styles.txAmount}>-{formatRand(tx.amountCents)}</Text>
          </View>
        ))}
      </Card>
      <Text style={styles.sectionTitle}>Self-management tools</Text>
      <Card>
        <View style={styles.toolRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolLabel}>Daily spending alert</Text>
            <Text style={styles.toolSub}>Notify me when I spend over a set amount</Text>
          </View>
          <Switch
            value={data?.dailyAlertEnabled ?? false}
            onValueChange={(v) => alertMut.mutate(v)}
            trackColor={{ true: colors.safe }}
          />
        </View>
        <View style={[styles.toolRow, styles.txRowBorder]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolLabel}>Request cooling-off period</Text>
            <Text style={styles.toolSub}>Pause gambling-related transactions for 30 days</Text>
          </View>
          <Pressable style={styles.toolButton} onPress={() => coolMut.mutate()}>
            <Text style={styles.toolButtonText}>Request</Text>
          </Pressable>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 20, fontWeight: '700', color: colors.navy, marginBottom: spacing.lg },
  summaryCard: { marginBottom: spacing.lg, padding: spacing.md },
  summaryCardOver: { borderColor: colors.risk, borderWidth: 1.5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  summaryAmount: { fontSize: 22, fontWeight: '700', color: colors.risk },
  summaryLimit: { fontSize: 22, fontWeight: '700', color: colors.navy },
  summaryLabel: { fontSize: 10.5, color: colors.muted },
  overLimitText: { fontSize: 11, color: colors.risk, fontWeight: '600', marginTop: spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md },
  txRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  txMerchant: { fontSize: 13, color: colors.text, fontWeight: '500' },
  txDate: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: '600', color: colors.risk },
  toolRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  toolLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  toolSub: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  toolButton: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  toolButtonText: { color: colors.white, fontSize: 11, fontWeight: '600' },
});
