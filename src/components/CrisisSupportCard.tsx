import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';

/** Recovered from the Expo web bundle. Helpline numbers match responsiblegambling.org.za. */
export function CrisisSupportCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Need to talk to someone right now?</Text>
      <Text style={styles.body}>
        The National Responsible Gambling Programme offers free, confidential counselling — 24 hours a
        day, in all 11 official languages.
      </Text>
      <Pressable
        style={styles.callButton}
        onPress={() => Linking.openURL('tel:0800006008')}
        accessibilityRole="button"
        accessibilityLabel="Call the NRGP counselling line, toll free, 0 8 0 0, 0 0 6, 0 0 8"
      >
        <Text style={styles.callButtonText}>Call 0800 006 008 (toll-free)</Text>
      </Pressable>
      <Pressable
        style={styles.whatsappButton}
        onPress={() => Linking.openURL('https://wa.me/27766750710?text=HELP')}
        accessibilityRole="button"
        accessibilityLabel="WhatsApp HELP to 0 7 6, 6 7 5, 0 7 1 0"
      >
        <Text style={styles.whatsappButtonText}>WhatsApp “HELP” to 076 675 0710</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#EAF3EE',
    borderColor: '#8FBFA4',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  title: { fontWeight: '800', fontSize: 14, color: '#1E4633', marginBottom: 4 },
  body: { fontSize: 12, color: '#2F5B44', lineHeight: 17, marginBottom: 10 },
  callButton: {
    backgroundColor: '#1B7A40',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  callButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  whatsappButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#1B7A40',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  whatsappButtonText: { color: '#1B7A40', fontWeight: '700', fontSize: 12.5 },
});
