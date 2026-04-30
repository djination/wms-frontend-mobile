import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { listInboundAsns, receiveInbound } from '../services/inbound-api';
import { InboundAsnSummary } from '../types/inbound';

type InboundReceiveScreenProps = {
  apiUrl: string;
  token: string;
  onBack: () => void;
};

type ScanTargetKey =
  | 'ASN'
  | 'PRODUCT'
  | 'SUPPLIER'
  | 'BIN'
  | 'QTY'
  | 'UOM'
  | 'LOT'
  | 'BATCH'
  | 'EXPIRY'
  | 'SERIALS';

const STEP_SCAN_SEQUENCE: ScanTargetKey[] = ['ASN', 'PRODUCT', 'SUPPLIER', 'BIN', 'QTY'];

const SCAN_KEY_MAP: Record<string, ScanTargetKey> = {
  ASN: 'ASN',
  INBOUNDASN: 'ASN',
  INBOUND_ASN: 'ASN',
  PRODUCT: 'PRODUCT',
  PRODUCTID: 'PRODUCT',
  PRODUCT_ID: 'PRODUCT',
  SUPPLIER: 'SUPPLIER',
  SUPPLIERID: 'SUPPLIER',
  SUPPLIER_ID: 'SUPPLIER',
  BIN: 'BIN',
  BINID: 'BIN',
  BIN_ID: 'BIN',
  QTY: 'QTY',
  UOM: 'UOM',
  LOT: 'LOT',
  BATCH: 'BATCH',
  EXP: 'EXPIRY',
  EXPIRY: 'EXPIRY',
  SERIALS: 'SERIALS',
  SNS: 'SERIALS',
};

function parseKeyValueScan(raw: string): { target: ScanTargetKey; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\s+/g, '');
  const separatorIndex = normalized.indexOf(':') >= 0 ? normalized.indexOf(':') : normalized.indexOf('=');
  if (separatorIndex <= 0) return null;

  const rawKey = normalized.slice(0, separatorIndex).toUpperCase();
  const value = normalized.slice(separatorIndex + 1).trim();
  const target = SCAN_KEY_MAP[rawKey];
  if (!target || !value) return null;

  return { target, value };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function hasMax4Decimals(value: number): boolean {
  const raw = String(value);
  const idx = raw.indexOf('.');
  if (idx < 0) return true;
  return raw.length - idx - 1 <= 4;
}

function isIsoDate(value: string): boolean {
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && value.includes('-');
}

function asNumber(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function InboundReceiveScreen({ apiUrl, token, onBack }: InboundReceiveScreenProps) {
  const [asnList, setAsnList] = useState<InboundAsnSummary[]>([]);
  const [asnLoading, setAsnLoading] = useState(false);
  const [selectedAsnId, setSelectedAsnId] = useState('');
  const [inboundAsnId, setInboundAsnId] = useState('');
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [binId, setBinId] = useState('');
  const [qtyReceived, setQtyReceived] = useState('');
  const [uomId, setUomId] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [serialNosText, setSerialNosText] = useState('');
  const [note, setNote] = useState('');
  const [scanText, setScanText] = useState('');
  const [scanValue, setScanValue] = useState('');
  const [scanTarget, setScanTarget] = useState<ScanTargetKey>('ASN');
  const [showOnlyRemainingItems, setShowOnlyRemainingItems] = useState(true);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanLock, setScanLock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const selectedAsn = useMemo(() => asnList.find((asn) => asn.id === selectedAsnId) ?? null, [asnList, selectedAsnId]);
  const selectedAsnItems = useMemo(() => {
    if (!selectedAsn) return [];
    const sorted = [...selectedAsn.items].sort((a, b) => {
      const aRemaining = Math.max(0, asNumber(a.qtyExpected) - asNumber(a.qtyReceived));
      const bRemaining = Math.max(0, asNumber(b.qtyExpected) - asNumber(b.qtyReceived));
      return bRemaining - aRemaining;
    });
    if (!showOnlyRemainingItems) return sorted;
    return sorted.filter((item) => asNumber(item.qtyExpected) - asNumber(item.qtyReceived) > 0);
  }, [selectedAsn, showOnlyRemainingItems]);
  const asnProgress = useMemo(() => {
    if (!selectedAsn) {
      return { totalItems: 0, remainingItems: 0, progressPercent: 0 };
    }
    const totalItems = selectedAsn.items.length;
    const remainingItems = selectedAsn.items.filter(
      (item) => Math.max(0, asNumber(item.qtyExpected) - asNumber(item.qtyReceived)) > 0,
    ).length;
    const progressPercent = totalItems > 0 ? Math.round(((totalItems - remainingItems) / totalItems) * 100) : 0;
    return { totalItems, remainingItems, progressPercent };
  }, [selectedAsn]);
  const qtyNumber = useMemo(() => Number(qtyReceived), [qtyReceived]);
  const submitDisabled =
    busy ||
    !inboundAsnId.trim() ||
    !productId.trim() ||
    !supplierId.trim() ||
    !binId.trim() ||
    !Number.isFinite(qtyNumber) ||
    qtyNumber <= 0;
  const currentStepIndex = STEP_SCAN_SEQUENCE.indexOf(scanTarget);
  const basicRequiredFilled =
    !!inboundAsnId.trim() && !!productId.trim() && !!supplierId.trim() && !!binId.trim() && Number.isFinite(qtyNumber) && qtyNumber > 0;

  const loadAsns = async (): Promise<InboundAsnSummary[]> => {
    setAsnLoading(true);
    setError(null);
    try {
      const rows = await listInboundAsns(apiUrl, token);
      const active = rows.filter((asn) => asn.status !== 'COMPLETED' && asn.status !== 'CANCELLED');
      setAsnList(active);
      return active;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengambil data ASN');
      return [];
    } finally {
      setAsnLoading(false);
    }
  };

  useEffect(() => {
    void loadAsns();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
  };

  const feedbackSuccess = (text: string) => {
    Vibration.vibrate(35);
    showToast('success', text);
  };

  const feedbackError = (text: string) => {
    Vibration.vibrate([0, 80, 60, 80]);
    showToast('error', text);
  };

  const pickAsn = (asn: InboundAsnSummary) => {
    setSelectedAsnId(asn.id);
    setInboundAsnId(asn.id);
    setMessage(`ASN dipilih: ${asn.asnNo}`);
    showToast('info', `ASN aktif: ${asn.asnNo}`);
  };

  const pickItem = (item: InboundAsnSummary['items'][number]) => {
    setProductId(item.productId);
    setSupplierId(item.supplierId);
    if (item.uomId) {
      setUomId(item.uomId);
    }
    const remainingQty = Math.max(0, asNumber(item.qtyExpected) - asNumber(item.qtyReceived));
    if (remainingQty > 0) {
      setQtyReceived(String(remainingQty));
    }
    setMessage('Produk, supplier, UOM, dan qty sisa terisi dari item ASN.');
    showToast('info', 'Item ASN dipilih dan field terisi otomatis.');
  };

  const applyScanPayload = () => {
    const pairs = scanText
      .split(/[|;\n]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (pairs.length === 0) {
      setError('Format scan kosong. Contoh: ASN:<id>;PRODUCT:<id>;SUPPLIER:<id>;BIN:<id>;QTY:10');
      feedbackError('Format scan payload kosong.');
      return;
    }
    const map: Record<string, string> = {};
    for (const pair of pairs) {
      const [rawKey, ...rest] = pair.split(':');
      if (!rawKey || rest.length === 0) continue;
      const key = rawKey.trim().toUpperCase();
      map[key] = rest.join(':').trim();
    }
    if (map.ASN) setInboundAsnId(map.ASN);
    if (map.PRODUCT) setProductId(map.PRODUCT);
    if (map.SUPPLIER) setSupplierId(map.SUPPLIER);
    if (map.BIN) setBinId(map.BIN);
    if (map.QTY) setQtyReceived(map.QTY);
    if (map.UOM) setUomId(map.UOM);
    if (map.LOT) setLotNo(map.LOT);
    if (map.BATCH) setBatchNo(map.BATCH);
    if (map.EXP || map.EXPIRY) setExpiryDate(map.EXP || map.EXPIRY);
    if (map.SERIALS || map.SNS) setSerialNosText(map.SERIALS || map.SNS);
    setMessage('Payload scan berhasil diterapkan.');
    setError(null);
    feedbackSuccess('Payload scan diterapkan.');
  };

  const writeScanTargetValue = (target: ScanTargetKey, value: string) => {
    if (target === 'ASN') setInboundAsnId(value);
    if (target === 'PRODUCT') setProductId(value);
    if (target === 'SUPPLIER') setSupplierId(value);
    if (target === 'BIN') setBinId(value);
    if (target === 'QTY') setQtyReceived(value);
    if (target === 'UOM') setUomId(value);
    if (target === 'LOT') setLotNo(value);
    if (target === 'BATCH') setBatchNo(value);
    if (target === 'EXPIRY') setExpiryDate(value);
    if (target === 'SERIALS') setSerialNosText(value);
  };

  const advanceStepIfAny = (target: ScanTargetKey) => {
    const nextIdx = STEP_SCAN_SEQUENCE.indexOf(target) + 1;
    if (nextIdx > 0 && nextIdx < STEP_SCAN_SEQUENCE.length) {
      setScanTarget(STEP_SCAN_SEQUENCE[nextIdx]);
    }
  };

  const applySingleScan = () => {
    const value = scanValue.trim();
    if (!value) {
      setError('Nilai scan kosong');
      feedbackError('Nilai scan kosong.');
      return;
    }
    const parsed = parseKeyValueScan(value);
    if (parsed) {
      writeScanTargetValue(parsed.target, parsed.value);
      advanceStepIfAny(parsed.target);
      setMessage(`Scan ${parsed.target} diterapkan (auto-detect).`);
      feedbackSuccess(`Scan ${parsed.target} diterapkan.`);
    } else {
      writeScanTargetValue(scanTarget, value);
      advanceStepIfAny(scanTarget);
      setMessage(`Scan ${scanTarget} diterapkan.`);
      feedbackSuccess(`Scan ${scanTarget} diterapkan.`);
    }
    setScanValue('');
    setError(null);
  };

  const openScanner = async () => {
    setError(null);
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        setError('Izin kamera diperlukan untuk scan barcode/QR.');
        feedbackError('Izin kamera ditolak.');
        return;
      }
    }
    setScannerVisible(true);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const qty = Number(qtyReceived);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('Qty harus lebih dari 0');
      }
      if (!hasMax4Decimals(qty)) {
        throw new Error('Qty maksimal 4 angka di belakang koma');
      }
      if (!isUuid(inboundAsnId)) {
        throw new Error('Format Inbound ASN ID tidak valid (harus UUID)');
      }
      if (!isUuid(productId)) {
        throw new Error('Format Product ID tidak valid (harus UUID)');
      }
      if (!isUuid(supplierId)) {
        throw new Error('Format Supplier ID tidak valid (harus UUID)');
      }
      if (!isUuid(binId)) {
        throw new Error('Format Bin ID tidak valid (harus UUID)');
      }
      if (uomId.trim() && !isUuid(uomId)) {
        throw new Error('Format UOM ID tidak valid (harus UUID)');
      }
      if (expiryDate.trim() && !isIsoDate(expiryDate.trim())) {
        throw new Error('Format Expiry Date tidak valid (gunakan ISO date)');
      }
      await receiveInbound(apiUrl, token, {
        inboundAsnId: inboundAsnId.trim(),
        productId: productId.trim(),
        supplierId: supplierId.trim(),
        binId: binId.trim(),
        qtyReceived: qty,
        uomId: uomId.trim() || undefined,
        lotNo: lotNo.trim() || undefined,
        batchNo: batchNo.trim() || undefined,
        expiryDate: expiryDate.trim() || undefined,
        serialNos: serialNosText
          .split(/[,\n|;]/)
          .map((v) => v.trim())
          .filter(Boolean),
        note: note.trim() || undefined,
      });
      setMessage('Receive inbound berhasil disimpan.');
      setQtyReceived('');
      setUomId('');
      setLotNo('');
      setBatchNo('');
      setExpiryDate('');
      setSerialNosText('');
      setNote('');
      const refreshedAsns = await loadAsns();
      if (selectedAsnId) {
        setInboundAsnId(selectedAsnId);
        const refreshedSelectedAsn = refreshedAsns.find((asn) => asn.id === selectedAsnId);
        const nextRemaining = refreshedSelectedAsn?.items.find(
          (item) => Math.max(0, asNumber(item.qtyExpected) - asNumber(item.qtyReceived)) > 0,
        );
        if (nextRemaining) {
          setProductId(nextRemaining.productId);
          setSupplierId(nextRemaining.supplierId);
          if (nextRemaining.uomId) setUomId(nextRemaining.uomId);
          const nextRemainingQty = Math.max(0, asNumber(nextRemaining.qtyExpected) - asNumber(nextRemaining.qtyReceived));
          setQtyReceived(String(nextRemainingQty));
          setMessage('Receive tersimpan. Item remaining berikutnya sudah dipilih otomatis.');
          feedbackSuccess('Receiving tersimpan. Lanjut ke item berikutnya.');
        } else {
          feedbackSuccess('Receiving tersimpan. Semua item ASN selesai.');
        }
      } else {
        feedbackSuccess('Receiving tersimpan.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Submit gagal';
      setError(msg);
      feedbackError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.card} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Inbound Receiving Scan</Text>
      <Text style={styles.sub}>Pilih ASN aktif, isi scan payload, lalu submit receiving.</Text>
      {toast ? (
        <View
          style={[
            styles.toast,
            toast.type === 'success' ? styles.toastSuccess : toast.type === 'error' ? styles.toastError : styles.toastInfo,
          ]}
        >
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Mode Scan Per Langkah</Text>
      <View style={styles.stepWrap}>
        {STEP_SCAN_SEQUENCE.map((step, idx) => (
          <Pressable
            key={step}
            style={[styles.stepButton, scanTarget === step && styles.stepButtonActive]}
            onPress={() => setScanTarget(step)}
          >
            <Text style={styles.stepText}>{idx + 1}. {step}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.helper}>
        Target aktif: {scanTarget}
        {currentStepIndex >= 0 ? ` (${currentStepIndex + 1}/${STEP_SCAN_SEQUENCE.length})` : ''}
      </Text>
      <View style={styles.scanRow}>
        <TextInput
          style={[styles.input, styles.scanInput]}
          value={scanValue}
          onChangeText={setScanValue}
          autoCapitalize="none"
          placeholder={`Scan nilai untuk ${scanTarget}`}
          placeholderTextColor="#6b7b8f"
        />
        <Pressable style={styles.secondaryButtonCompact} onPress={applySingleScan}>
          <Text style={styles.secondaryButtonText}>Apply</Text>
        </Pressable>
        <Pressable style={styles.secondaryButtonCompact} onPress={openScanner}>
          <Text style={styles.secondaryButtonText}>Scan Camera</Text>
        </Pressable>
      </View>
      {scannerVisible ? (
        <View style={styles.scannerCard}>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={
              scanLock
                ? undefined
                : ({ data }) => {
                    if (!data) return;
                    setScanLock(true);
                    const value = String(data).trim();
                    const parsed = parseKeyValueScan(value);
                    if (parsed) {
                      writeScanTargetValue(parsed.target, parsed.value);
                      advanceStepIfAny(parsed.target);
                      setMessage(`Scan kamera terbaca untuk ${parsed.target} (auto-detect).`);
                      feedbackSuccess(`Scan kamera: ${parsed.target}`);
                    } else {
                      writeScanTargetValue(scanTarget, value);
                      advanceStepIfAny(scanTarget);
                      setMessage(`Scan kamera terbaca untuk ${scanTarget}.`);
                      feedbackSuccess(`Scan kamera: ${scanTarget}`);
                    }
                    setError(null);
                    setScannerVisible(false);
                    setTimeout(() => setScanLock(false), 500);
                  }
            }
          />
          <Pressable style={styles.secondaryButtonCompact} onPress={() => setScannerVisible(false)}>
            <Text style={styles.secondaryButtonText}>Tutup Scanner</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.rowButtons}>
        <Pressable style={styles.secondaryButtonCompact} onPress={loadAsns} disabled={asnLoading}>
          <Text style={styles.secondaryButtonText}>{asnLoading ? 'Loading ASN...' : 'Refresh ASN'}</Text>
        </Pressable>
      </View>

      {asnList.length > 0 ? (
        <>
          <Text style={styles.label}>ASN Aktif</Text>
          <View style={styles.choiceWrap}>
            {asnList.slice(0, 8).map((asn) => (
              <Pressable
                key={asn.id}
                style={[styles.choiceButton, selectedAsnId === asn.id && styles.choiceButtonActive]}
                onPress={() => pickAsn(asn)}
              >
                <Text style={styles.choiceText}>{asn.asnNo}</Text>
                <Text style={styles.choiceSub}>{asn.status}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {selectedAsn && selectedAsn.items.length > 0 ? (
        <>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Item</Text>
              <Text style={styles.summaryValue}>{asnProgress.totalItems}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Remaining</Text>
              <Text style={styles.summaryValue}>{asnProgress.remainingItems}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Progress</Text>
              <Text style={styles.summaryValue}>{asnProgress.progressPercent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${asnProgress.progressPercent}%` }]} />
            </View>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Item ASN (tap untuk isi Product + Supplier)</Text>
            <Pressable style={styles.filterButton} onPress={() => setShowOnlyRemainingItems((v) => !v)}>
              <Text style={styles.filterButtonText}>
                {showOnlyRemainingItems ? 'Show All' : 'Only Remaining'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.choiceWrap}>
            {selectedAsnItems.slice(0, 12).map((item) => {
              const remaining = Math.max(0, asNumber(item.qtyExpected) - asNumber(item.qtyReceived));
              const done = remaining <= 0;
              return (
              <Pressable
                key={item.id}
                style={[styles.itemChoiceButton, done ? styles.itemDone : styles.itemRemaining]}
                onPress={() => pickItem(item)}
              >
                <Text style={styles.choiceText}>{item.product?.sku || item.product?.name || item.productId}</Text>
                <Text style={styles.choiceSub}>{item.supplier?.name || item.supplierId}</Text>
                <Text style={styles.choiceSub}>
                  Remaining: {remaining} {item.uom?.code ?? ''}
                </Text>
                <Text style={[styles.statusBadge, done ? styles.statusDone : styles.statusRemaining]}>
                  {done ? 'COMPLETED' : 'REMAINING'}
                </Text>
              </Pressable>
            );
            })}
            {selectedAsnItems.length === 0 ? (
              <Text style={styles.helper}>Tidak ada item tersisa untuk ASN ini.</Text>
            ) : null}
          </View>
        </>
      ) : null}

      <Text style={styles.label}>Scan Payload (optional)</Text>
      <TextInput
        style={styles.input}
        value={scanText}
        onChangeText={setScanText}
        autoCapitalize="characters"
        placeholder="ASN:<id>;PRODUCT:<id>;SUPPLIER:<id>;BIN:<id>;QTY:10;LOT:...;BATCH:...;EXP:2027-04-30;SERIALS:SN1,SN2"
        placeholderTextColor="#6b7b8f"
      />
      <Pressable style={styles.secondaryButtonCompact} onPress={applyScanPayload}>
        <Text style={styles.secondaryButtonText}>Terapkan Scan Payload</Text>
      </Pressable>

      <Text style={styles.label}>Inbound ASN ID</Text>
      <TextInput style={styles.input} value={inboundAsnId} onChangeText={setInboundAsnId} autoCapitalize="none" />
      <Text style={styles.label}>Product ID</Text>
      <TextInput style={styles.input} value={productId} onChangeText={setProductId} autoCapitalize="none" />
      <Text style={styles.label}>Supplier ID</Text>
      <TextInput style={styles.input} value={supplierId} onChangeText={setSupplierId} autoCapitalize="none" />
      <Text style={styles.label}>Bin ID</Text>
      <TextInput style={styles.input} value={binId} onChangeText={setBinId} autoCapitalize="none" />
      <Text style={styles.label}>Qty Received</Text>
      <TextInput
        style={styles.input}
        value={qtyReceived}
        onChangeText={setQtyReceived}
        keyboardType="decimal-pad"
        autoCapitalize="none"
      />
      <Text style={styles.label}>UOM ID (optional)</Text>
      <TextInput style={styles.input} value={uomId} onChangeText={setUomId} autoCapitalize="none" />
      <Text style={styles.label}>Lot No (optional)</Text>
      <TextInput style={styles.input} value={lotNo} onChangeText={setLotNo} />
      <Text style={styles.label}>Batch No (optional)</Text>
      <TextInput style={styles.input} value={batchNo} onChangeText={setBatchNo} />
      <Text style={styles.label}>Expiry Date ISO (optional)</Text>
      <TextInput
        style={styles.input}
        value={expiryDate}
        onChangeText={setExpiryDate}
        autoCapitalize="none"
        placeholder="2027-04-30T00:00:00.000Z"
        placeholderTextColor="#6b7b8f"
      />
      <Text style={styles.label}>Serial Nos (optional, pisahkan koma/newline)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={serialNosText}
        onChangeText={setSerialNosText}
        multiline
        numberOfLines={3}
        placeholder="SN-001, SN-002"
        placeholderTextColor="#6b7b8f"
      />
      <Text style={styles.label}>Note (optional)</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} />

      <Pressable style={[styles.button, (submitDisabled || !basicRequiredFilled) && styles.buttonDisabled]} onPress={submit} disabled={submitDisabled || !basicRequiredFilled}>
        {busy ? <ActivityIndicator color="#0f1419" /> : <Text style={styles.buttonText}>Submit Receiving</Text>}
      </Pressable>
      {submitDisabled || !basicRequiredFilled ? (
        <Text style={styles.helper}>Lengkapi ASN, product, supplier, bin, dan qty valid.</Text>
      ) : (
        <Text style={styles.helper}>Validasi format tetap dicek saat submit (UUID/ISO/decimal).</Text>
      )}
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
  rowButtons: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryCard: {
    borderWidth: 1,
    borderColor: '#314153',
    borderRadius: 8,
    backgroundColor: '#102331',
    padding: 10,
    marginBottom: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { color: '#93a8bd', fontSize: 12 },
  summaryValue: { color: '#dbeafe', fontWeight: '700' },
  progressTrack: {
    marginTop: 4,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#294158',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  title: { color: '#e7e9ea', fontWeight: '700', fontSize: 18, marginBottom: 4 },
  sub: { color: '#8b98a5', marginBottom: 12 },
  label: { color: '#c7d2df', fontSize: 12 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 10 },
  stepWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 6 },
  stepButton: {
    borderWidth: 1,
    borderColor: '#314153',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stepButtonActive: { borderColor: '#7dd3fc', backgroundColor: '#102331' },
  stepText: { color: '#dbeafe', fontSize: 12, fontWeight: '600' },
  scanRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  scanInput: { flex: 1, marginBottom: 0 },
  scannerCard: {
    borderWidth: 1,
    borderColor: '#314153',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  camera: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  choiceButton: {
    borderWidth: 1,
    borderColor: '#314153',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: '30%',
  },
  choiceButtonActive: { borderColor: '#7dd3fc', backgroundColor: '#102331' },
  itemChoiceButton: {
    borderWidth: 1,
    borderColor: '#314153',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '100%',
  },
  itemRemaining: { borderColor: '#7dd3fc', backgroundColor: '#102331' },
  itemDone: { borderColor: '#355144', backgroundColor: '#10261d' },
  choiceText: { color: '#dbeafe', fontWeight: '600' },
  choiceSub: { color: '#93a8bd', marginTop: 2, fontSize: 12 },
  statusBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    overflow: 'hidden',
    fontWeight: '700',
  },
  statusRemaining: { backgroundColor: '#0ea5e9', color: '#07233a' },
  statusDone: { backgroundColor: '#22c55e', color: '#062713' },
  filterButton: {
    borderWidth: 1,
    borderColor: '#4b5e73',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  filterButtonText: { color: '#dbeafe', fontSize: 12, fontWeight: '600' },
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
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
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
  toast: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  toastSuccess: { backgroundColor: '#10261d', borderColor: '#22c55e' },
  toastError: { backgroundColor: '#2a1313', borderColor: '#f87171' },
  toastInfo: { backgroundColor: '#102331', borderColor: '#38bdf8' },
  toastText: { color: '#e7e9ea', fontSize: 12, fontWeight: '600' },
});
