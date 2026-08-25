import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme/colors';

export default function CoachingBookingScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Book a session</Text>
      <Text style={styles.body}>
        Coaching is a real-world service. Checkout is PayFast on the backend — the web demo does not
        post a live merchant payment.
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
