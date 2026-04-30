import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Vibration } from 'react-native';
import { listInventoryBalances, upsertInventoryBalance } from '../services/inventory-api';
import { InventoryBalanceSummary } from '../types/inventory';

type CycleCountScreenProps = {
  apiUrl: string;
  token: string;
  onBack: () => void;
};

function asNumber(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function CycleCountScreen({ apiUrl, token, onBack }: CycleCountScreenProps) {
  const [balances, setBalances] = useState<InventoryBalanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedBalanceId, setSelectedBalanceId] = useState('');
  const [countedQty, setCountedQty] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedBalance = useMemo(() => balances.find((b) => b.id === selectedBalanceId) ?? null, [balances, selectedBalanceId]);

  const loadBalances = async (): Promise<InventoryBalanceSummary[]> => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listInventoryBalances(apiUrl, token);
      setBalances(rows);
      return rows;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal load inventory balance');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBalances();
  }, []);

  const pickBalance = (row: InventoryBalanceSummary) => {
    setSelectedBalanceId(row.id);
    setCountedQty(String(asNumber(row.qtyOnHand)));
    setMessage('Baris inventory dipilih untuk cycle count.');
    setError(null);
    Vibration.vibrate(25);
  };

  const submitCount = async () => {
    if (!selectedBalance) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const qty = Number(countedQty);
      if (!Number.isFinite(qty) || qty < 0) throw new Error('Qty count harus angka >= 0');
      await upsertInventoryBalance(apiUrl, token, {
        customerId: selectedBalance.customerId,
        warehouseId: selectedBalance.warehouseId,
        binId: selectedBalance.binId,
        productId: selectedBalance.productId,
        qtyOnHand: qty,
      });
      await loadBalances();
      setMessage('Cycle count tersimpan (qty on hand diperbarui).');
      Vibration.vibrate(40);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal simpan cycle count';
      setError(msg);
      Vibration.vibrate([0, 80, 60, 80]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.card} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Cycle Count Scan</Text>
      <Text style={styles.sub}>Pilih inventory row, input qty hasil hitung, lalu simpan.</Text>

      <View style={styles.rowButtons}>
        <Pressable style={styles.secondaryButtonCompact} onPress={loadBalances} disabled={loading}>
          <Text style={styles.secondaryButtonText}>{loading ? 'Loading inventory...' : 'Refresh Inventory'}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Inventory Balances</Text>
      <View style={styles.choiceWrap}>
        {balances.slice(0, 20).map((row) => (
          <Pressable
            key={row.id}
            style={[styles.itemButton, selectedBalanceId === row.id && styles.itemButtonActive]}
            onPress={() => pickBalance(row)}
          >
            <Text style={styles.choiceText}>{row.product?.sku || row.product?.name || row.productId}</Text>
            <Text style={styles.choiceSub}>Bin: {row.bin?.code || row.binId}</Text>
            <Text style={styles.choiceSub}>Qty On Hand: {asNumber(row.qtyOnHand)}</Text>
          </Pressable>
        ))}
        {balances.length === 0 ? <Text style={styles.helper}>Belum ada inventory balance di scope user.</Text> : null}
      </View>

      <Text style={styles.label}>Counted Qty</Text>
      <TextInput style={styles.input} value={countedQty} onChangeText={setCountedQty} keyboardType="decimal-pad" />

      <Pressable style={[styles.button, (!selectedBalanceId || busy) && styles.buttonDisabled]} onPress={submitCount} disabled={!selectedBalanceId || busy}>
        {busy ? <ActivityIndicator color="#0f1419" /> : <Text style={styles.buttonText}>Simpan Cycle Count</Text>}
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
  itemButton: {
    borderWidth: 1,
    borderColor: '#314153',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '100%',
    backgroundColor: '#102331',
  },
  itemButtonActive: { borderColor: '#7dd3fc' },
  choiceText: { color: '#dbeafe', fontWeight: '600' },
  choiceSub: { color: '#93a8bd', marginTop: 2, fontSize: 12 },
  input: {
    backgroundColor: '#0b1117',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#304053',
    color: '#e7e9ea',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 6,
    marginBottom: 10,
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
