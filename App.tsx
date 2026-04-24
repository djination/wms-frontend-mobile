import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? extra?.apiUrl ?? 'http://localhost:4000';

export default function App() {
  const [health, setHealth] = useState<string>('loading…');

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((j) => setHealth(JSON.stringify(j, null, 2)))
      .catch(() => setHealth('API unreachable — set EXPO_PUBLIC_API_URL or app.json extra.apiUrl'));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WMS Mobile</Text>
      <Text style={styles.sub}>Expo · Android & iOS ready (prebuild / dev client)</Text>
      {health === 'loading…' ? (
        <ActivityIndicator color="#38bdf8" />
      ) : (
        <Text style={styles.pre}>{health}</Text>
      )}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  title: { color: '#e7e9ea', fontSize: 22, fontWeight: '700' },
  sub: { color: '#8b98a5', marginTop: 8, marginBottom: 20 },
  pre: { color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 },
});
