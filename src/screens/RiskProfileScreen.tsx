import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SimulatedBadge } from '../components/SimulatedBadge';
import { env } from '../config/env';
import { colors, spacing } from '../theme/colors';

export default function RiskProfileScreen() {
  if (!env.features.riskProfileModule) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Know Your Risk</Text>
        <Text style={styles.body}>
          Risk Portrait is off in this environment. Production stays off until counsel clears FAIS
          product-recommendation questions.
        </Text>
      </ScrollView>
    );
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SimulatedBadge note="results illustrative, no product recommendations" />
      <Text style={styles.title}>Know Your Risk</Text>
      <Text style={styles.body}>
        This assessment is illustrative. Matched products from the API are not advice and are not
        shown as a recommendation in this recovered client.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontSize: 20, fontWeight: '700', color: colors.navy, marginBottom: spacing.md },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
