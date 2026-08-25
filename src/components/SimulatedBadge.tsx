import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { env } from '../config/env';

export function SimulatedBadge({ note }: { note?: string }) {
  if (env.appEnv === 'production') return null;
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <View style={styles.pill}>
        <Text style={styles.pillText}>SIMULATED</Text>
      </View>
      <Text style={styles.note}>
        {note ??
          'Shown for demonstration only. This feature is not yet live and does not represent an actual financial product or offer.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFF7E6',
    borderColor: '#F0C36D',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pill: {
    backgroundColor: '#B7791F',
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  pillText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  note: { flex: 1, color: '#7A5A1E', fontSize: 11, lineHeight: 15 },
});
