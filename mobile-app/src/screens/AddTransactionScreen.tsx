import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, FlatList } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ocrApi, transactionsApi, categoriesApi, accountsApi } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radius, fontSize, fontWeight, shadow } from '../theme/tokens';
import LocationPicker from '../components/LocationPicker';
import { parseSmsTransaction } from '../services/smsParser';
import { repository } from '../database/repository';
import { TABLES } from '../database/schema';
import type { Category, Account } from '../types';

type Tab = 'manual' | 'scan' | 'sms';

export default function AddTransactionScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const initialTab: Tab = route?.params?.tab || 'manual';
  const prefill = route?.params?.prefill || {};
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ocrData, setOcrData] = useState<any>(null);
  const cameraRef = useRef<CameraView>(null);

  // SMS
  const [smsText, setSmsText] = useState('');
  const [smsResult, setSmsResult] = useState<any>(null);

  // Form
  const [description, setDescription] = useState(prefill.description || '');
  const [amount, setAmount] = useState(prefill.amount?.toString() || '');
  const [isExpense, setIsExpense] = useState(prefill.is_expense !== false);
  const [category, setCategory] = useState(prefill.category || '');
  const [selectedAccount, setSelectedAccount] = useState(prefill.account_id || '');
  const [date, setDate] = useState(() => new Date(prefill.date || new Date().toISOString().slice(0, 10)));
  const [showPicker, setShowPicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string; name?: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    Promise.all([
      categoriesApi.list().then((r) => setCategories(r.data?.items || r.data || [])).catch(() => {}),
      accountsApi.list().then((r) => setAccounts(r.data?.items || r.data || [])).catch(() => {}),
    ]).finally(() => setFetching(false));
  }, []);

  const filteredCategories = useMemo(() =>
    categories.filter((c) => c.type === (isExpense ? 'expense' : 'income')),
    [categories, isExpense]
  );

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.md, paddingBottom: 40, flexGrow: 1 },
    tabRow: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.lg, marginHorizontal: spacing.md, marginTop: spacing.sm },
    tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: colors.card },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
    tabTextActive: { color: '#fff' },
    typeToggle: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.lg },
    typeBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', backgroundColor: colors.card },
    typeBtnActive: { backgroundColor: colors.primary },
    typeBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.textSecondary },
    typeBtnTextActive: { color: '#fff' },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
    input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.base, color: colors.text },
    dateInput: {
      backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      padding: spacing.md, fontSize: fontSize.base, color: colors.text,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    categoryChip: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card,
    },
    categoryChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
    accChip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card,
    },
    accChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    accChipText: { fontSize: fontSize.sm, color: colors.textSecondary },
    saveBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.xl },
    saveBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: '#fff' },
    // Camera
    camera: { flex: 1, minHeight: 300, borderRadius: radius.md, overflow: 'hidden' },
    cameraOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    frameGuide: { width: '80%', height: '40%', borderWidth: 2, borderColor: colors.textInverse, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', opacity: 0.7 },
    frameText: { color: colors.textInverse, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
    cameraControls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: spacing.lg },
    captureBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
    captureInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.textInverse },
    galleryBtn: { padding: spacing.md },
    galleryBtnText: { color: colors.primary, fontWeight: fontWeight.medium, fontSize: fontSize.base },
    preview: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.border, marginBottom: spacing.md },
    actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    secondaryBtn: { flex: 1, backgroundColor: colors.tagBg, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
    secondaryBtnText: { color: colors.textSecondary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
    resultCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm, marginBottom: spacing.md },
    resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
    resultLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
    resultValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
    exampleCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.primary, marginBottom: spacing.md },
    exampleText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },
    useResultBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
    useResultBtnText: { color: '#fff', fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  }), [colors]);

  const handleDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selected) setDate(selected);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!description.trim() || !amount) return;
    setSaving(true);
    try {
      const payload = {
        description: description.trim(),
        amount: isExpense ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount)),
        type: isExpense ? 'expense' : 'income',
        account_id: selectedAccount || undefined,
        category_id: category || undefined,
        date: date.toISOString().slice(0, 10),
        notes: notes.trim() || undefined,
        location: location || undefined,
      };
      const res = await transactionsApi.create(payload);
      await repository.create(TABLES.TRANSACTIONS, res.data);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to add transaction');
    } finally {
      setSaving(false);
    }
  };

  // Camera functions
  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) processImage(result.assets[0].uri);
  }

  async function capturePhoto() {
    if (!cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) processImage(photo.uri);
    } catch { Alert.alert('Error', 'Failed to capture photo'); }
    finally { setCapturing(false); }
  }

  async function processImage(uri: string) {
    setImageUri(uri);
    setProcessing(true);
    setOcrData(null);
    try {
      const res = await ocrApi.scan({ uri, type: 'image/jpeg', name: 'receipt.jpg' });
      const extracted = {
        merchant: res.data.merchant,
        amount: res.data.amount,
        date: res.data.date,
        category: res.data.category,
        raw_text: res.data.raw_text || res.data.text || JSON.stringify(res.data),
      };
      setOcrData(extracted);
    } catch (err: any) {
      Alert.alert('OCR Failed', err.response?.data?.detail || err.message || 'Could not read receipt');
      setImageUri(null);
    } finally { setProcessing(false); }
  }

  function applyOcr() {
    if (!ocrData) return;
    if (ocrData.amount) setAmount(Math.abs(ocrData.amount).toString());
    if (ocrData.merchant) setDescription(ocrData.merchant);
    if (ocrData.date) setDate(new Date(ocrData.date));
    if (ocrData.category) setCategory(ocrData.category);
    setActiveTab('manual');
  }

  // SMS functions
  function handleParseSms() {
    if (!smsText.trim()) return;
    const parsed = parseSmsTransaction(smsText);
    if (parsed) {
      setSmsResult(parsed);
    } else {
      Alert.alert('No match', 'Could not parse a transaction from this SMS.');
      setSmsResult(null);
    }
  }

  function applySms() {
    if (!smsResult) return;
    setDescription(smsResult.description);
    setAmount(smsResult.amount.toString());
    setIsExpense(smsResult.type === 'expense');
    if (smsResult.merchant) setDescription(smsResult.merchant);
    setActiveTab('manual');
  }

  const renderManualTab = () => (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.typeToggle}>
        <TouchableOpacity style={[styles.typeBtn, isExpense && styles.typeBtnActive]} onPress={() => setIsExpense(true)}>
          <Text style={[styles.typeBtnText, isExpense && styles.typeBtnTextActive]}>Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.typeBtn, !isExpense && styles.typeBtnActive]} onPress={() => setIsExpense(false)}>
          <Text style={[styles.typeBtnText, !isExpense && styles.typeBtnTextActive]}>Income</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Description</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="e.g., Groceries" placeholderTextColor={colors.textTertiary} />

      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />

      <Text style={styles.label}>Category</Text>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={filteredCategories} keyExtractor={(c: Category) => c.id}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}
        renderItem={({ item: c }) => {
          const active = category === c.id;
          return (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                active && { backgroundColor: (c.color || colors.primary) + '20', borderColor: c.color || colors.primary },
              ]}
              onPress={() => setCategory(active ? '' : c.id)}
            >
              <Text style={{ fontSize: 16 }}>{c.icon}</Text>
              <Text style={[styles.categoryChipText, active && { color: colors.primary, fontWeight: fontWeight.semibold }]}>{c.name}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={{ fontSize: fontSize.sm, color: colors.textTertiary, fontStyle: 'italic' }}>No categories found</Text>
        }
      />

      <Text style={styles.label}>Account</Text>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={accounts} keyExtractor={(a: Account) => a.id}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}
        renderItem={({ item: a }) => {
          const active = selectedAccount === a.id;
          return (
            <TouchableOpacity
              style={[styles.accChip, active && styles.accChipActive]}
              onPress={() => setSelectedAccount(active ? '' : a.id)}
            >
              <Text style={[styles.accChipText, active && { color: colors.primary, fontWeight: fontWeight.semibold }]}>{a.name}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={{ fontSize: fontSize.sm, color: colors.textTertiary, fontStyle: 'italic' }}>No accounts found</Text>
        }
      />

      <Text style={styles.label}>Date</Text>
      <TouchableOpacity style={styles.dateInput} onPress={() => setShowPicker(true)} accessibilityLabel="Select date">
        <Text style={{ color: colors.text }}>{date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        <Text style={{ fontSize: 16 }}>📅</Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={handleDateChange} />
      )}

      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} placeholder="Optional notes..." placeholderTextColor={colors.textTertiary} multiline numberOfLines={3} />

      <Text style={styles.label}>Location</Text>
      <LocationPicker location={location} onLocationChange={setLocation} />

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: saving ? colors.textTertiary : colors.primary }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Transaction</Text>}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderScanTab = () => {
    if (!permission) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>;

    if (imageUri && !processing && ocrData) {
      return (
        <ScrollView contentContainerStyle={styles.content}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Receipt preview" />
          <View style={styles.resultCard}>
            {ocrData.merchant && <View style={styles.resultRow}><Text style={styles.resultLabel}>Merchant</Text><Text style={styles.resultValue}>{ocrData.merchant}</Text></View>}
            {ocrData.amount && <View style={styles.resultRow}><Text style={styles.resultLabel}>Amount</Text><Text style={styles.resultValue}>₹{ocrData.amount}</Text></View>}
            {ocrData.date && <View style={styles.resultRow}><Text style={styles.resultLabel}>Date</Text><Text style={styles.resultValue}>{ocrData.date}</Text></View>}
            {ocrData.raw_text && <Text style={{ fontSize: fontSize.xs, color: colors.textTertiary, marginTop: spacing.sm, fontStyle: 'italic' }}>{ocrData.raw_text}</Text>}
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.saveBtn} onPress={applyOcr} accessibilityLabel="Use scanned data" accessibilityRole="button">
              <Text style={styles.saveBtnText}>Use Data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setImageUri(null); setOcrData(null); }} accessibilityLabel="Rescan" accessibilityRole="button">
              <Text style={styles.secondaryBtnText}>Rescan</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    if (processing || capturing) {
      return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /><Text style={{ marginTop: spacing.md, color: colors.textSecondary }}>{processing ? 'Processing receipt...' : 'Capturing...'}</Text></View>;
    }

    if (!permission?.granted) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl }}>
          <Text style={{ fontSize: fontSize.lg, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl }}>Camera access is needed to scan receipts</Text>
          <TouchableOpacity style={[styles.saveBtn, { width: '80%' }]} onPress={requestPermission} accessibilityLabel="Grant camera permission" accessibilityRole="button">
            <Text style={styles.saveBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: spacing.md }} onPress={pickFromGallery} accessibilityLabel="Pick from gallery" accessibilityRole="button">
            <Text style={styles.galleryBtnText}>Pick from Gallery</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.camera}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          <View style={styles.cameraOverlay}><View style={styles.frameGuide}><Text style={styles.frameText}>Align receipt here</Text></View></View>
        </View>
        <View style={styles.cameraControls}>
          <TouchableOpacity onPress={pickFromGallery} accessibilityLabel="Pick from gallery" accessibilityRole="button">
            <Text style={styles.galleryBtnText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.captureBtn, capturing && { opacity: 0.5 }]} onPress={capturePhoto} disabled={capturing} accessibilityLabel="Capture photo" accessibilityRole="button">
            <View style={styles.captureInner} />
          </TouchableOpacity>
          <View style={{ width: 60 }} />
        </View>
      </View>
    );
  };

  const renderSmsTab = () => (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={{ backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', ...shadow.md, marginBottom: spacing.lg }}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>💬</Text>
        <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.sm }}>Import from SMS</Text>
        <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
          Paste a bank SMS below to automatically extract the transaction details.
        </Text>
      </View>

      <Text style={styles.label}>Bank SMS</Text>
      <TextInput
        style={[styles.input, { minHeight: 100, textAlignVertical: 'top', marginBottom: spacing.md }]}
        value={smsText} onChangeText={setSmsText}
        placeholder="Paste your bank SMS here..." placeholderTextColor={colors.textTertiary}
        multiline numberOfLines={4}
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleParseSms}>
        <Text style={styles.saveBtnText}>Parse Transaction</Text>
      </TouchableOpacity>

      {smsResult && (
        <View style={styles.resultCard}>
          <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md }}>Parsed Transaction</Text>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Description:</Text><Text style={styles.resultValue}>{smsResult.description}</Text></View>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Amount:</Text><Text style={styles.resultValue}>₹{smsResult.amount}</Text></View>
          <View style={styles.resultRow}><Text style={styles.resultLabel}>Type:</Text><Text style={[styles.resultValue, { color: smsResult.type === 'expense' ? colors.danger : colors.success }]}>{smsResult.type}</Text></View>
          <TouchableOpacity style={styles.useResultBtn} onPress={applySms} accessibilityLabel="Use SMS data" accessibilityRole="button">
            <Text style={styles.useResultBtnText}>Fill Form with This Data</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.exampleCard}>
        <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm }}>Example SMS</Text>
        <Text style={styles.exampleText}>
          "₹1,500 debited from HDFC Bank A/c xx1234 at SWIGGY on 15 Jan. Avl bal: ₹12,000"
        </Text>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, activeTab === 'manual' && styles.tabActive]} onPress={() => setActiveTab('manual')}>
            <Text style={[styles.tabText, activeTab === 'manual' && styles.tabTextActive]}>✏️ Manual</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'scan' && styles.tabActive]} onPress={() => setActiveTab('scan')}>
            <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>📷 Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'sms' && styles.tabActive]} onPress={() => setActiveTab('sms')}>
            <Text style={[styles.tabText, activeTab === 'sms' && styles.tabTextActive]}>💬 SMS</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'manual' && renderManualTab()}
        {activeTab === 'scan' && renderScanTab()}
        {activeTab === 'sms' && renderSmsTab()}
      </KeyboardAvoidingView>
    </View>
  );
}
