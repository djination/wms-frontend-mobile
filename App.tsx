import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { MOBILE_OPERATIONS } from './src/constants/mobile-operations';
import { CycleCountScreen } from './src/screens/CycleCountScreen';
import { InboundReceiveScreen } from './src/screens/InboundReceiveScreen';
import { InternalTransferScreen } from './src/screens/InternalTransferScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OperationMenuScreen } from './src/screens/OperationMenuScreen';
import { OutboundPackLoadScreen } from './src/screens/OutboundPackLoadScreen';
import { OutboundPickingScreen } from './src/screens/OutboundPickingScreen';
import { loginMobile } from './src/services/auth-api';

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? extra?.apiUrl ?? 'http://localhost:4000';

export default function App() {
  const [activeView, setActiveView] = useState<
    'menu' | 'inbound-receiving' | 'outbound-picking' | 'outbound-pack-load' | 'internal-transfer' | 'cycle-count'
  >('menu');
  const [email, setEmail] = useState('admin@wms.local');
  const [password, setPassword] = useState('password123');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = async () => {
    setBusy(true);
    setError(null);
    try {
      setToken(await loginMobile(API_URL, email, password));
      setActiveView('menu');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WMS Mobile Operations</Text>
      <Text style={styles.sub}>Operator login untuk proses scan operasional gudang</Text>

      {!token ? (
        <LoginScreen
          apiUrl={API_URL}
          email={email}
          password={password}
          busy={busy}
          error={error}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={login}
        />
      ) : activeView === 'inbound-receiving' ? (
        <InboundReceiveScreen apiUrl={API_URL} token={token} onBack={() => setActiveView('menu')} />
      ) : activeView === 'outbound-picking' ? (
        <OutboundPickingScreen apiUrl={API_URL} token={token} onBack={() => setActiveView('menu')} />
      ) : activeView === 'outbound-pack-load' ? (
        <OutboundPackLoadScreen apiUrl={API_URL} token={token} onBack={() => setActiveView('menu')} />
      ) : activeView === 'internal-transfer' ? (
        <InternalTransferScreen apiUrl={API_URL} token={token} onBack={() => setActiveView('menu')} />
      ) : activeView === 'cycle-count' ? (
        <CycleCountScreen apiUrl={API_URL} token={token} onBack={() => setActiveView('menu')} />
      ) : (
        <OperationMenuScreen
          apiUrl={API_URL}
          token={token}
          operations={MOBILE_OPERATIONS}
          onOpenInboundReceiving={() => setActiveView('inbound-receiving')}
          onOpenOutboundPicking={() => setActiveView('outbound-picking')}
          onOpenOutboundPackLoad={() => setActiveView('outbound-pack-load')}
          onOpenInternalTransfer={() => setActiveView('internal-transfer')}
          onOpenCycleCount={() => setActiveView('cycle-count')}
          onLogout={() => {
            setToken(null);
            setActiveView('menu');
          }}
        />
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
  sub: { color: '#8b98a5', marginTop: 8, marginBottom: 16 },
});
