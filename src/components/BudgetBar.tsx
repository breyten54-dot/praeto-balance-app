import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius } from '../theme/colors';

export function BudgetBar({
  spentCents,
  limitCents,
}: {
  spentCents: number;
  limitCents: number;
}) {
  const ratio = limitCents <= 0 ? 0 : Math.min(1, spentCents / limitCents);
  const over = spentCents > limitCents;
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          { width: `${Math.round(ratio * 100)}%`, backgroundColor: over ? colors.risk : colors.gold },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: radius.pill },
});
