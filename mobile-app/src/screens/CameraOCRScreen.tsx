import React, { useState, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ocrApi } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radius, fontSize, fontWeight } from '../theme/tokens';

interface ExtractedData {
  merchant?: string;
  amount?: number;
  date?: string;
  category?: string;
  raw_text: string;
}

export default function CameraOCRScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.xxl },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  frameGuide: { width: '80%', height: '40%', borderWidth: 2, borderColor: colors.textInverse, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', opacity: 0.7 },
  frameText: { color: colors.textInverse, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  cameraControls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', padding: spacing.xxl, backgroundColor: colors.black },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.textInverse },
  galleryPickBtn: { padding: spacing.md },
  galleryPickText: { color: colors.textInverse, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  preview: { width: '100%', height: 250, backgroundColor: colors.border },
  resultCard: { backgroundColor: colors.surface, padding: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, marginTop: -20 },
  resultTitle: { fontSize: fontSize.lg + 1, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md + 2 },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.slate500, marginBottom: spacing.xs },
  fieldInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: fontSize.base, color: colors.text },
  rawText: { fontSize: fontSize.sm, color: colors.slate500, fontStyle: 'italic', backgroundColor: colors.background, padding: spacing.sm, borderRadius: radius.sm },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  saveBtn: { flex: 1, backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  saveBtnText: { color: colors.textInverse, fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  rescanBtn: { flex: 1, backgroundColor: colors.tagBg, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  rescanBtnText: { color: colors.slate500, fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  permissionText: { fontSize: fontSize.lg, color: colors.slate500, textAlign: 'center', marginBottom: spacing.xl },
  permissionBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md + 2, borderRadius: radius.md, marginBottom: spacing.md },
  permissionBtnText: { color: colors.textInverse, fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  galleryBtn: { padding: spacing.md },
  galleryBtnText: { color: colors.primary, fontWeight: fontWeight.medium, fontSize: fontSize.base },
  processingText: { marginTop: spacing.md, fontSize: fontSize.base, color: colors.slate500 },
}), [colors, spacing, radius, fontSize, fontWeight]);
  const [permission, requestPermission] = useCameraPermissions();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [data, setData] = useState<ExtractedData | null>(null);
  const cameraRef = useRef<CameraView>(null);

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
    setData(null);
    try {
      const res = await ocrApi.scan({ uri, type: 'image/jpeg', name: 'receipt.jpg' });
      setData({
        merchant: res.data.merchant,
        amount: res.data.amount,
        date: res.data.date,
        category: res.data.category,
        raw_text: res.data.raw_text || res.data.text || JSON.stringify(res.data),
      });
    } catch (err: any) {
      Alert.alert('OCR Failed', err.response?.data?.detail || err.message || 'Could not read receipt');
      setImageUri(null);
    } finally { setProcessing(false); }
  }

  async function saveAsTransaction() {
    if (!data?.amount) { Alert.alert('No Amount', 'Could not detect an amount. Edit the fields manually.'); return; }
    navigation.navigate('AddTransaction', { prefill: { amount: Math.abs(data.amount), description: data.merchant || data.raw_text?.slice(0, 100) || 'Receipt scan', merchant: data.merchant || '', date: data.date || new Date().toISOString().slice(0, 10), is_expense: (data.amount || 0) > 0 } });
  }

  function resetScanner() { setImageUri(null); setData(null); }

  if (!permission) return <View style={styles.centered} accessibilityLabel="Checking camera permission"><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!permission.granted) {
    return <View style={styles.centered}>
      <Text style={styles.permissionText}>Camera access is needed to scan receipts</Text>
      <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} accessibilityLabel="Grant camera permission" accessibilityRole="button"><Text style={styles.permissionBtnText}>Grant Permission</Text></TouchableOpacity>
      <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery} accessibilityLabel="Pick from gallery" accessibilityRole="button"><Text style={styles.galleryBtnText}>Pick from Gallery</Text></TouchableOpacity>
    </View>;
  }

  if (imageUri && !processing) {
    return <ScrollView style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Receipt preview" />
      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>Extracted Data</Text>
        <View style={styles.field}><Text style={styles.fieldLabel}>Merchant</Text><TextInput style={styles.fieldInput} value={data?.merchant || ''} onChangeText={(t) => setData((d) => d ? { ...d, merchant: t } : null)} placeholder="Merchant name" placeholderTextColor={colors.textTertiary} accessibilityLabel="Merchant name" /></View>
        <View style={styles.field}><Text style={styles.fieldLabel}>Amount (₹)</Text><TextInput style={styles.fieldInput} value={data?.amount?.toString() || ''} onChangeText={(t) => setData((d) => d ? { ...d, amount: parseFloat(t) || 0 } : null)} placeholder="0.00" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" accessibilityLabel="Amount" /></View>
        <View style={styles.field}><Text style={styles.fieldLabel}>Date</Text><TextInput style={styles.fieldInput} value={data?.date || ''} onChangeText={(t) => setData((d) => d ? { ...d, date: t } : null)} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} accessibilityLabel="Date" /></View>
        {data?.raw_text ? <View style={styles.field}><Text style={styles.fieldLabel}>Raw Text</Text><Text style={styles.rawText}>{data.raw_text}</Text></View> : null}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.saveBtn} onPress={saveAsTransaction} accessibilityLabel="Save as transaction" accessibilityRole="button"><Text style={styles.saveBtnText}>Save as Transaction</Text></TouchableOpacity>
          <TouchableOpacity style={styles.rescanBtn} onPress={resetScanner} accessibilityLabel="Scan again" accessibilityRole="button"><Text style={styles.rescanBtnText}>Scan Again</Text></TouchableOpacity>
        </View>
      </View>
    </ScrollView>;
  }

  if (processing) return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.processingText}>Processing receipt...</Text></View>;

  return <View style={styles.container}>
    <View style={styles.camera}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <View style={styles.cameraOverlay}><View style={styles.frameGuide}><Text style={styles.frameText}>Align receipt here</Text></View></View>
    </View>
    <View style={styles.cameraControls}>
      <TouchableOpacity style={styles.galleryPickBtn} onPress={pickFromGallery} accessibilityLabel="Pick from gallery" accessibilityRole="button"><Text style={styles.galleryPickText}>Gallery</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.captureBtn, capturing && { opacity: 0.5 }]} onPress={capturePhoto} disabled={capturing} accessibilityLabel="Capture photo" accessibilityRole="button">
        <View style={styles.captureInner} />
      </TouchableOpacity>
      <View style={{ width: 60 }} />
    </View>
  </View>;
}

