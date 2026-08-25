import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.msg}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.btn} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  msg: { color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  btn: {
    backgroundColor: colors.navy,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  btnText: { color: colors.white, fontWeight: '700' },
});
