import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Vibration } from 'react-native';
import { completeOutboundTask, listOutboundTasks } from '../services/outbound-api';
import { OutboundTaskSummary } from '../types/outbound';

type OutboundPackLoadScreenProps = {
  apiUrl: string;
  token: string;
  onBack: () => void;
};

type TaskStage = 'PACKING' | 'LOADING';

function asNumber(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function OutboundPackLoadScreen({ apiUrl, token, onBack }: OutboundPackLoadScreenProps) {
  const [stage, setStage] = useState<TaskStage>('PACKING');
  const [tasks, setTasks] = useState<OutboundTaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [qtyDone, setQtyDone] = useState('');
  const [serialNosText, setSerialNosText] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stageTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.taskType === stage && (t.status === 'OPEN' || t.status === 'IN_PROGRESS'))
        .sort((a, b) => Math.max(0, asNumber(b.qtyTask) - asNumber(b.qtyDone)) - Math.max(0, asNumber(a.qtyTask) - asNumber(a.qtyDone))),
    [tasks, stage],
  );

  const selectedTask = useMemo(() => stageTasks.find((t) => t.id === selectedTaskId) ?? null, [stageTasks, selectedTaskId]);

  const loadTasks = async (): Promise<OutboundTaskSummary[]> => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listOutboundTasks(apiUrl, token);
      setTasks(rows);
      return rows;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal load outbound tasks');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  useEffect(() => {
    setSelectedTaskId('');
    setQtyDone('');
    setSerialNosText('');
    setNote('');
  }, [stage]);

  const pickTask = (task: OutboundTaskSummary) => {
    setSelectedTaskId(task.id);
    const remaining = Math.max(0, asNumber(task.qtyTask) - asNumber(task.qtyDone));
    setQtyDone(String(remaining));
    setSerialNosText(Array.isArray(task.serialNos) ? task.serialNos.join(', ') : '');
    setMessage(`${stage} task dipilih.`);
    setError(null);
    Vibration.vibrate(25);
  };

  const completeSelectedTask = async () => {
    if (!selectedTask) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const qty = Number(qtyDone);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Qty done harus lebih dari 0');
      await completeOutboundTask(apiUrl, token, selectedTask.id, {
        qtyDone: qty,
        note: note.trim() || undefined,
        serialNos: serialNosText
          .split(/[,\n|;]/)
          .map((v) => v.trim())
          .filter(Boolean),
      });
      const refreshed = await loadTasks();
      setNote('');
      setMessage(`${stage} task berhasil di-complete.`);
      Vibration.vibrate(40);
      const next = refreshed
        .filter((t) => t.taskType === stage && (t.status === 'OPEN' || t.status === 'IN_PROGRESS'))
        .sort((a, b) => Math.max(0, asNumber(b.qtyTask) - asNumber(b.qtyDone)) - Math.max(0, asNumber(a.qtyTask) - asNumber(a.qtyDone)))[0];
      if (next) pickTask(next);
      else setSelectedTaskId('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Gagal complete ${stage} task`;
      setError(msg);
      Vibration.vibrate([0, 80, 60, 80]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.card} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Outbound Pack & Load Scan</Text>
      <Text style={styles.sub}>Pilih tahap PACKING/LOADING, lalu complete task operasional.</Text>

      <View style={styles.stageRow}>
        <Pressable style={[styles.stageButton, stage === 'PACKING' && styles.stageButtonActive]} onPress={() => setStage('PACKING')}>
          <Text style={styles.stageText}>PACKING</Text>
        </Pressable>
        <Pressable style={[styles.stageButton, stage === 'LOADING' && styles.stageButtonActive]} onPress={() => setStage('LOADING')}>
          <Text style={styles.stageText}>LOADING</Text>
        </Pressable>
      </View>

      <View style={styles.rowButtons}>
        <Pressable style={styles.secondaryButtonCompact} onPress={loadTasks} disabled={loading}>
          <Text style={styles.secondaryButtonText}>{loading ? 'Loading tasks...' : 'Refresh Tasks'}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Task {stage} Open/In Progress</Text>
      <View style={styles.choiceWrap}>
        {stageTasks.slice(0, 16).map((task) => {
          const remaining = Math.max(0, asNumber(task.qtyTask) - asNumber(task.qtyDone));
          return (
            <Pressable
              key={task.id}
              style={[styles.taskButton, selectedTaskId === task.id && styles.taskButtonActive]}
              onPress={() => pickTask(task)}
            >
              <Text style={styles.choiceText}>{task.salesOrder?.orderNo || task.salesOrder?.id || '-'}</Text>
              <Text style={styles.choiceSub}>{task.salesOrderItem?.product?.sku || task.salesOrderItem?.product?.name || '-'}</Text>
              <Text style={styles.choiceSub}>Remaining: {remaining}</Text>
            </Pressable>
          );
        })}
        {stageTasks.length === 0 ? <Text style={styles.helper}>Tidak ada task {stage} terbuka.</Text> : null}
      </View>

      <Text style={styles.label}>Task ID</Text>
      <TextInput style={styles.input} value={selectedTaskId} onChangeText={setSelectedTaskId} autoCapitalize="none" />
      <Text style={styles.label}>Qty Done</Text>
      <TextInput style={styles.input} value={qtyDone} onChangeText={setQtyDone} keyboardType="decimal-pad" />
      <Text style={styles.label}>Serial Nos (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={serialNosText}
        onChangeText={setSerialNosText}
        multiline
        numberOfLines={3}
        placeholder="SN-OUT-001, SN-OUT-002"
        placeholderTextColor="#6b7b8f"
      />
      <Text style={styles.label}>Note (optional)</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} />

      <Pressable style={[styles.button, (!selectedTaskId || busy) && styles.buttonDisabled]} onPress={completeSelectedTask} disabled={!selectedTaskId || busy}>
        {busy ? <ActivityIndicator color="#0f1419" /> : <Text style={styles.buttonText}>Complete {stage} Task</Text>}
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
  stageRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  stageButton: {
    borderWidth: 1,
    borderColor: '#314153',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stageButtonActive: { borderColor: '#7dd3fc', backgroundColor: '#102331' },
  stageText: { color: '#dbeafe', fontWeight: '700', fontSize: 12 },
  label: { color: '#c7d2df', fontSize: 12 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 10 },
  taskButton: {
    borderWidth: 1,
    borderColor: '#314153',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '100%',
    backgroundColor: '#102331',
  },
  taskButtonActive: { borderColor: '#7dd3fc' },
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
  textArea: { minHeight: 72, textAlignVertical: 'top' },
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
