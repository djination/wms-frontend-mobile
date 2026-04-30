import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type LoginScreenProps = {
  apiUrl: string;
  email: string;
  password: string;
  busy: boolean;
  error: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
};

export function LoginScreen({
  apiUrl,
  email,
  password,
  busy,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: LoginScreenProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>API Base</Text>
      <Text style={styles.apiBase}>{apiUrl}</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput style={styles.input} value={password} onChangeText={onPasswordChange} secureTextEntry />

      <Pressable style={[styles.button, busy && styles.buttonDisabled]} disabled={busy} onPress={onSubmit}>
        {busy ? <ActivityIndicator color="#0f1419" /> : <Text style={styles.buttonText}>Login Mobile</Text>}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#151c24',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#263341',
    padding: 14,
    gap: 8,
    maxHeight: '80%',
  },
  label: { color: '#c7d2df', fontSize: 12 },
  apiBase: { color: '#7dd3fc', marginBottom: 8, fontSize: 12 },
  input: {
    backgroundColor: '#0b1117',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#304053',
    color: '#e7e9ea',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 6,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#0f1419', fontWeight: '700' },
  error: { color: '#fca5a5', marginTop: 4 },
});
