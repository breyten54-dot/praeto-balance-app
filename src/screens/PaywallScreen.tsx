import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme/colors';

export default function PaywallScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Praeto Balance Premium</Text>
      <Text style={styles.body}>
        Subscriptions go through RevenueCat on iOS and Android. The web demo does not take a live
        IAP payment.
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
