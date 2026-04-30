import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { listInboundAsns } from '../services/inbound-api';
import { listInventoryBalances } from '../services/inventory-api';
import { listOutboundTasks } from '../services/outbound-api';
import { listInternalTransfers } from '../services/process-flow-api';

type OperationMenuScreenProps = {
  apiUrl: string;
  token: string;
  operations: string[];
  onOpenInboundReceiving: () => void;
  onOpenOutboundPicking: () => void;
  onOpenOutboundPackLoad: () => void;
  onOpenInternalTransfer: () => void;
  onOpenCycleCount: () => void;
  onLogout: () => void;
};

export function OperationMenuScreen({
  apiUrl,
  token,
  operations,
  onOpenInboundReceiving,
  onOpenOutboundPicking,
  onOpenOutboundPackLoad,
  onOpenInternalTransfer,
  onOpenCycleCount,
  onLogout,
}: OperationMenuScreenProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    inboundActiveAsn: 0,
    outboundPickingOpen: 0,
    outboundPackLoadOpen: 0,
    transferDraft: 0,
    inventoryRows: 0,
  });

  const shortToken = useMemo(() => {
    if (token.length < 28) return token;
    return `${token.slice(0, 14)}...${token.slice(-10)}`;
  }, [token]);

  const refreshSummary = async () => {
    setBusy(true);
    setError(null);
    try {
      const [asns, tasks, transfers, balances] = await Promise.all([
        listInboundAsns(apiUrl, token),
        listOutboundTasks(apiUrl, token),
        listInternalTransfers(apiUrl, token),
        listInventoryBalances(apiUrl, token),
      ]);
      setSummary({
        inboundActiveAsn: asns.filter((a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED').length,
        outboundPickingOpen: tasks.filter((t) => t.taskType === 'PICKING' && (t.status === 'OPEN' || t.status === 'IN_PROGRESS')).length,
        outboundPackLoadOpen: tasks.filter(
          (t) => (t.taskType === 'PACKING' || t.taskType === 'LOADING') && (t.status === 'OPEN' || t.status === 'IN_PROGRESS'),
        ).length,
        transferDraft: transfers.filter((t) => t.status === 'DRAFT').length,
        inventoryRows: balances.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat dashboard ringkas');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refreshSummary();
  }, []);

  return (
    <ScrollView style={styles.card} contentContainerStyle={styles.listContent}>
      <Text style={styles.welcome}>Login berhasil</Text>
      <Text style={styles.tokenText}>Token: {shortToken}</Text>
      <View style={styles.summaryCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Dashboard Ringkas</Text>
          <Pressable style={styles.refreshButton} onPress={refreshSummary} disabled={busy}>
            <Text style={styles.refreshButtonText}>{busy ? 'Refreshing...' : 'Refresh'}</Text>
          </Pressable>
        </View>
        <Text style={styles.summaryText}>Inbound active ASN: {summary.inboundActiveAsn}</Text>
        <Text style={styles.summaryText}>Outbound picking open: {summary.outboundPickingOpen}</Text>
        <Text style={styles.summaryText}>Outbound pack/load open: {summary.outboundPackLoadOpen}</Text>
        <Text style={styles.summaryText}>Internal transfer draft: {summary.transferDraft}</Text>
        <Text style={styles.summaryText}>Inventory rows in scope: {summary.inventoryRows}</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
      <Text style={styles.sectionTitle}>Menu operasional mobile:</Text>
      {operations.map((item) => (
        <View key={item} style={styles.listItem}>
          <Text style={styles.listBullet}>{'\u2022'}</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
      <Pressable style={styles.primaryButton} onPress={onOpenInboundReceiving}>
        <Text style={styles.primaryButtonText}>Buka Inbound Receiving Scan</Text>
      </Pressable>
      <Pressable style={styles.primaryButtonSecondary} onPress={onOpenOutboundPicking}>
        <Text style={styles.primaryButtonText}>Buka Outbound Picking Scan</Text>
      </Pressable>
      <Pressable style={styles.primaryButtonSecondary} onPress={onOpenOutboundPackLoad}>
        <Text style={styles.primaryButtonText}>Buka Outbound Pack & Load Scan</Text>
      </Pressable>
      <Pressable style={styles.primaryButtonSecondary} onPress={onOpenInternalTransfer}>
        <Text style={styles.primaryButtonText}>Buka Internal Transfer Scan</Text>
      </Pressable>
      <Pressable style={styles.primaryButtonSecondary} onPress={onOpenCycleCount}>
        <Text style={styles.primaryButtonText}>Buka Cycle Count Scan</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onLogout}>
        <Text style={styles.secondaryButtonText}>Logout</Text>
      </Pressable>
    </ScrollView>
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
  welcome: { color: '#86efac', fontWeight: '700', marginBottom: 4 },
  tokenText: { color: '#94a3b8', fontSize: 11, marginBottom: 10 },
  summaryCard: {
    borderWidth: 1,
    borderColor: '#314153',
    borderRadius: 8,
    backgroundColor: '#102331',
    padding: 10,
    marginBottom: 10,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryText: { color: '#cbd5e1', marginTop: 4, fontSize: 12 },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#4b5e73',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  refreshButtonText: { color: '#dbeafe', fontWeight: '600', fontSize: 12 },
  errorText: { color: '#fca5a5', marginTop: 6, fontSize: 12 },
  sectionTitle: { color: '#e7e9ea', fontWeight: '700', marginBottom: 6 },
  listContent: { paddingBottom: 8 },
  listItem: { flexDirection: 'row', gap: 8, marginBottom: 6, paddingRight: 8 },
  listBullet: { color: '#7dd3fc' },
  listText: { color: '#cbd5e1', flex: 1 },
  primaryButton: {
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#38bdf8',
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#0f1419', fontWeight: '700' },
  primaryButtonSecondary: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#67e8f9',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4b5e73',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#dbeafe', fontWeight: '600' },
});
