import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export default function LoadingSpinner({ size = 'md', message }: Props) {
  const dim = size === 'sm' ? 24 : size === 'lg' ? 48 : 36;
  return (
    <View style={styles.container}>
      <ActivityIndicator size={dim as any} color="#0284c7" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  message: { marginTop: 12, fontSize: 14, color: '#64748b' },
});
