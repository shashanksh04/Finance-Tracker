import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { spacing, radius, fontSize, fontWeight } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { getCurrentLocation } from '../services/location';

interface LocationPickerProps {
  location: { latitude: number; longitude: number; address?: string; name?: string } | null;
  onLocationChange: (loc: { latitude: number; longitude: number; address?: string; name?: string } | null) => void;
}

export default function LocationPicker({ location, onLocationChange }: LocationPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { marginTop: spacing.sm },
  tagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  tagIcon: { fontSize: 16, marginRight: spacing.sm },
  tagText: { fontSize: fontSize.base, color: colors.textSecondary },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight + '15',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  locIcon: { fontSize: 20, marginRight: spacing.sm },
  locDetails: { flex: 1 },
  locName: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.text },
  locAddress: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  removeBtn: { padding: spacing.xs, marginLeft: spacing.sm },
  removeBtnText: { fontSize: 16, color: colors.danger },
}), [colors, spacing, radius, fontSize, fontWeight]);
  const [loading, setLoading] = useState(false);

  const handleTagLocation = async () => {
    setLoading(true);
    const loc = await getCurrentLocation();
    onLocationChange(loc);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {location ? (
        <View style={styles.locationInfo}>
          <Text style={styles.locIcon}>📍</Text>
          <View style={styles.locDetails}>
            <Text style={styles.locName}>{location.name || 'Tagged Location'}</Text>
            {location.address && <Text style={styles.locAddress}>{location.address}</Text>}
          </View>
          <TouchableOpacity onPress={() => onLocationChange(null)} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={handleTagLocation} style={styles.tagBtn} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Text style={styles.tagIcon}>📍</Text>
              <Text style={styles.tagText}>Tag Location</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}


