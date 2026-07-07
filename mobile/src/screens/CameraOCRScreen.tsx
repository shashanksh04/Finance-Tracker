import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, ScrollView, Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ocrApi } from '../services/api';

interface ExtractedData {
  merchant?: string;
  amount?: number;
  date?: string;
  category?: string;
  raw_text: string;
}

export default function CameraOCRScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [data, setData] = useState<ExtractedData | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>Camera access is needed to scan receipts</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
          <Text style={styles.galleryBtnText}>Pick from Gallery</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      processImage(result.assets[0].uri);
    }
  }

  async function capturePhoto() {
    if (!cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        processImage(photo.uri);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setCapturing(false);
    }
  }

  async function processImage(uri: string) {
    setImageUri(uri);
    setProcessing(true);
    setData(null);

    try {
      const res = await ocrApi.scan({
        uri,
        type: 'image/jpeg',
        name: 'receipt.jpg',
      });

      setData({
        merchant: res.data.merchant,
        amount: res.data.amount,
        date: res.data.date,
        category: res.data.category,
        raw_text: res.data.raw_text || res.data.text || JSON.stringify(res.data),
      });
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || 'OCR processing failed';
      Alert.alert('OCR Failed', typeof detail === 'string' ? detail : 'Could not read receipt');
      setImageUri(null);
    } finally {
      setProcessing(false);
    }
  }

  async function saveAsTransaction() {
    if (!data?.amount) {
      Alert.alert('No Amount', 'Could not detect an amount. Edit the fields manually.');
      return;
    }

    navigation.navigate('AddTransaction', {
      prefill: {
        amount: Math.abs(data.amount),
        description: data.merchant || data.raw_text?.slice(0, 100) || 'Receipt scan',
        merchant: data.merchant || '',
        date: data.date || new Date().toISOString().slice(0, 10),
        is_expense: data.amount > 0,
      },
    });
  }

  function resetScanner() {
    setImageUri(null);
    setData(null);
  }

  if (imageUri && !processing) {
    return (
      <ScrollView style={styles.container}>
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Extracted Data</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Merchant</Text>
            <TextInput
              style={styles.fieldInput}
              value={data?.merchant || ''}
              onChangeText={(t) => setData((d) => d ? { ...d, merchant: t } : null)}
              placeholder="Merchant name"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Amount (₹)</Text>
            <TextInput
              style={styles.fieldInput}
              value={data?.amount?.toString() || ''}
              onChangeText={(t) => setData((d) => d ? { ...d, amount: parseFloat(t) || 0 } : null)}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Date</Text>
            <TextInput
              style={styles.fieldInput}
              value={data?.date || ''}
              onChangeText={(t) => setData((d) => d ? { ...d, date: t } : null)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
            />
          </View>

          {data?.raw_text ? (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Raw Text</Text>
              <Text style={styles.rawText}>{data.raw_text}</Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.saveBtn} onPress={saveAsTransaction}>
              <Text style={styles.saveBtnText}>Save as Transaction</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rescanBtn} onPress={resetScanner}>
              <Text style={styles.rescanBtnText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (processing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.processingText}>Processing receipt...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        <View style={styles.cameraOverlay}>
          <View style={styles.frameGuide}>
            <Text style={styles.frameText}>Align receipt here</Text>
          </View>
        </View>
      </CameraView>

      <View style={styles.cameraControls}>
        <TouchableOpacity style={styles.galleryPickBtn} onPress={pickFromGallery}>
          <Text style={styles.galleryPickText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.captureBtn, capturing && { opacity: 0.5 }]}
          onPress={capturePhoto}
          disabled={capturing}
        >
          <View style={styles.captureInner} />
        </TouchableOpacity>
        <View style={{ width: 60 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: 24 },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  frameGuide: {
    width: '80%', height: '40%', borderWidth: 2, borderColor: '#fff',
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    borderStyle: 'dashed', opacity: 0.7,
  },
  frameText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  cameraControls: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    padding: 24, backgroundColor: '#000',
  },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  galleryPickBtn: { padding: 12 },
  galleryPickText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  preview: { width: '100%', height: 250, backgroundColor: '#e2e8f0' },
  resultCard: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -20 },
  resultTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  fieldInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, color: '#0f172a' },
  rawText: { fontSize: 13, color: '#64748b', fontStyle: 'italic', backgroundColor: '#f8fafc', padding: 8, borderRadius: 8 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  saveBtn: { flex: 1, backgroundColor: '#0284c7', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  rescanBtn: { flex: 1, backgroundColor: '#f1f5f9', padding: 16, borderRadius: 12, alignItems: 'center' },
  rescanBtnText: { color: '#64748b', fontWeight: '600', fontSize: 15 },
  permissionText: { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  permissionBtn: { backgroundColor: '#0284c7', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, marginBottom: 12 },
  permissionBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  galleryBtn: { padding: 12 },
  galleryBtnText: { color: '#0284c7', fontWeight: '500', fontSize: 15 },
  processingText: { marginTop: 12, fontSize: 15, color: '#64748b' },
});
