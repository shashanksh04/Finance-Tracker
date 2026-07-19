import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { spacing, radius, fontSize, fontWeight } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import LocationPicker from './LocationPicker';

type InputType = 'text' | 'currency' | 'date' | 'location' | 'textarea';

interface SmartInputSuiteProps {
  label: string;
  value: any;
  onChange: (val: any) => void;
  type?: InputType;
  placeholder?: string;
  error?: string;
  currencySymbol?: string;
}

export default function SmartInputSuite({ label, value, onChange, type = 'text', placeholder, error, currencySymbol = '₹' }: SmartInputSuiteProps) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    wrapper: { marginBottom: spacing.md },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary, marginBottom: spacing.xs },
    input: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: error ? colors.danger : colors.border,
      padding: spacing.md,
      fontSize: fontSize.base,
      color: colors.text,
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    dateInput: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    errorText: { fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.xs },
    currencyPrefix: { flexDirection: 'row', alignItems: 'center' },
    prefixText: { fontSize: fontSize.base, color: colors.text, marginRight: spacing.xs },
  }), [colors, error]);

  const handleDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selected) onChange(selected);
  };

  const renderInput = () => {
    switch (type) {
      case 'currency':
        return (
          <View style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={styles.prefixText}>{currencySymbol}</Text>
            <TextInput
              style={{ flex: 1, fontSize: fontSize.base, color: colors.text, padding: 0 }}
              value={value?.toString() || ''}
              onChangeText={onChange}
              placeholder={placeholder || '0.00'}
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
          </View>
        );
      case 'date':
        return (
          <>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowPicker(true)} accessibilityLabel="Select date">
              <Text style={{ color: colors.text }}>
                {value ? (typeof value === 'string' ? value : value.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })) : 'Select date'}
              </Text>
              <Text style={{ fontSize: 16 }}>📅</Text>
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker
                value={value ? (typeof value === 'string' ? new Date(value) : value) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
              />
            )}
          </>
        );
      case 'location':
        return <LocationPicker location={value} onLocationChange={onChange} />;
      case 'textarea':
        return (
          <TextInput
            style={[styles.input, styles.textArea]}
            value={value?.toString() || ''}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        );
      default:
        return (
          <TextInput
            style={styles.input}
            value={value?.toString() || ''}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
          />
        );
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      {renderInput()}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}
