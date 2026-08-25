import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { colors, radius, spacing } from '../theme/colors';

const NRGP_SELF_EXCLUSION = 'https://responsiblegambling.org.za/self-exclusion-2/';
const NGB_FORM = 'https://www.ngb.org.za/';

/**
 * Outbound NRGP / NGB self-exclusion. This is not operator or bank enforcement —
 * the in-app 30-day cooling-off remains a local pause only.
 */
export function SelfExclusionCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>National self-exclusion</Text>
      <Text style={styles.body}>
        Formal self-exclusion from gambling is handled by the National Responsible Gambling Programme
        and the National Gambling Board (Form NGB 1/1). Praeto Balance cannot block operators or your
        bank. The 30-day cooling-off below is an in-app pause only.
      </Text>
      <Pressable
        style={styles.primary}
        onPress={() => Linking.openURL(NRGP_SELF_EXCLUSION)}
        accessibilityRole="link"
        accessibilityLabel="Open NRGP self-exclusion on responsiblegambling.org.za"
      >
        <Text style={styles.primaryText}>NRGP self-exclusion process</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={() => Linking.openURL(NGB_FORM)}
        accessibilityRole="link"
        accessibilityLabel="Open National Gambling Board for Form NGB 1/1 guidance"
      >
        <Text style={styles.secondaryText}>NGB Form NGB 1/1 guidance</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.navy,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: spacing.lg,
  },
  title: { fontWeight: '800', fontSize: 14, color: colors.navy, marginBottom: 4 },
  body: { fontSize: 12, color: colors.text, lineHeight: 17, marginBottom: 10 },
  primary: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  secondary: {
    backgroundColor: colors.white,
    borderColor: colors.navy,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  secondaryText: { color: colors.navy, fontWeight: '700', fontSize: 12.5 },
});
