import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, Vibration } from 'react-native';
import { completeInternalTransfer, listInternalTransfers } from '../services/process-flow-api';
import { InternalTransferSummary } from '../types/process-flow';

type InternalTransferScreenProps = {
  apiUrl: string;
  token: string;
  onBack: () => void;
};

export function InternalTransferScreen({ apiUrl, token, onBack }: InternalTransferScreenProps) {
  const [transfers, setTransfers] = useState<InternalTransferSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draftTransfers = useMemo(
    () => transfers.filter((t) => t.status === 'DRAFT').sort((a, b) => b.lines.length - a.lines.length),
    [transfers],
  );
  const selectedTransfer = useMemo(
    () => draftTransfers.find((t) => t.id === selectedTransferId) ?? null,
    [draftTransfers, selectedTransferId],
  );

  const loadTransfers = async (): Promise<InternalTransferSummary[]> => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listInternalTransfers(apiUrl, token);
      setTransfers(rows);
      return rows;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal load transfer internal');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTransfers();
  }, []);

  const pickTransfer = (transfer: InternalTransferSummary) => {
    setSelectedTransferId(transfer.id);
    setMessage(`Transfer dipilih: ${transfer.transferNo}`);
    setError(null);
    Vibration.vibrate(25);
  };

  const completeSelectedTransfer = async () => {
    if (!selectedTransferId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await completeInternalTransfer(apiUrl, token, selectedTransferId);
      const refreshed = await loadTransfers();
      setMessage('Transfer berhasil di-complete.');
      Vibration.vibrate(45);
      const next = refreshed.filter((t) => t.status === 'DRAFT')[0];
      if (next) {
        setSelectedTransferId(next.id);
      } else {
        setSelectedTransferId('');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal complete transfer';
      setError(msg);
      Vibration.vibrate([0, 80, 60, 80]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.card} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Internal Transfer Scan</Text>
      <Text style={styles.sub}>Pilih transfer draft, verifikasi line, lalu complete transfer.</Text>

      <View style={styles.rowButtons}>
        <Pressable style={styles.secondaryButtonCompact} onPress={loadTransfers} disabled={loading}>
          <Text style={styles.secondaryButtonText}>{loading ? 'Loading transfers...' : 'Refresh Transfers'}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Transfer DRAFT</Text>
      <View style={styles.choiceWrap}>
        {draftTransfers.slice(0, 16).map((transfer) => (
          <Pressable
            key={transfer.id}
            style={[styles.transferButton, selectedTransferId === transfer.id && styles.transferButtonActive]}
            onPress={() => pickTransfer(transfer)}
          >
            <Text style={styles.choiceText}>{transfer.transferNo}</Text>
            <Text style={styles.choiceSub}>
              {transfer.fromWarehouse?.code || transfer.fromWarehouseId} → {transfer.toWarehouse?.code || transfer.toWarehouseId}
            </Text>
            <Text style={styles.choiceSub}>Lines: {transfer.lines.length}</Text>
          </Pressable>
        ))}
        {draftTransfers.length === 0 ? <Text style={styles.helper}>Tidak ada transfer draft.</Text> : null}
      </View>

      {selectedTransfer ? (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Detail Lines</Text>
          {selectedTransfer.lines.map((line) => (
            <View key={line.id} style={styles.lineRow}>
              <Text style={styles.choiceText}>{line.product?.sku || line.product?.name || line.productId}</Text>
              <Text style={styles.choiceSub}>
                {line.sourceBin?.code || line.sourceBinId} → {line.destinationBin?.code || line.destinationBinId}
              </Text>
              <Text style={styles.choiceSub}>
                Qty: {line.qty} {line.uom?.code ?? ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable
        style={[styles.button, (!selectedTransferId || busy) && styles.buttonDisabled]}
        onPress={completeSelectedTransfer}
        disabled={!selectedTransferId || busy}
      >
        {busy ? <ActivityIndicator color="#0f1419" /> : <Text style={styles.buttonText}>Complete Transfer</Text>}
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>Kembali ke menu</Text>
      </Pressable>

      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
    maxHeight: '80%',
  },
  content: { paddingBottom: 8 },
  title: { color: '#e7e9ea', fontWeight: '700', fontSize: 18, marginBottom: 4 },
  sub: { color: '#8b98a5', marginBottom: 12 },
  rowButtons: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  label: { color: '#c7d2df', fontSize: 12 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 10 },
  transferButton: {
    borderWidth: 1,
    borderColor: '#314153',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '100%',
    backgroundColor: '#102331',
  },
  transferButtonActive: { borderColor: '#7dd3fc' },
  detailCard: {
    borderWidth: 1,
    borderColor: '#314153',
    borderRadius: 8,
    backgroundColor: '#102331',
    padding: 10,
    marginBottom: 10,
  },
  sectionTitle: { color: '#e7e9ea', fontWeight: '700', marginBottom: 6 },
  lineRow: {
    borderWidth: 1,
    borderColor: '#2a3b4f',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginBottom: 7,
  },
  choiceText: { color: '#dbeafe', fontWeight: '600' },
  choiceSub: { color: '#93a8bd', marginTop: 2, fontSize: 12 },
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
  secondaryButton: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4b5e73',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonCompact: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4b5e73',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#dbeafe', fontWeight: '600' },
  success: { color: '#86efac', marginTop: 10 },
  error: { color: '#fca5a5', marginTop: 10 },
  helper: { color: '#93a8bd', marginTop: 8, fontSize: 12 },
});
