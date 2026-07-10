import React, { useMemo } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { spacing, radius, fontSize, fontWeight } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'decimal-pad' | 'numeric' | 'phone-pad' | 'url';
  multiline?: boolean;
  editable?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export default function FormField({
  label, value, onChangeText, placeholder, error,
  secureTextEntry, keyboardType, multiline, editable, maxLength,
  autoCapitalize,
}: FormFieldProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { marginBottom: spacing.md + 2 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md + 2, fontSize: fontSize.base, color: colors.text },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  disabled: { backgroundColor: colors.tagBg, color: colors.textTertiary },
  error: { fontSize: fontSize.xs + 1, color: colors.error, marginTop: spacing.xs },
}), [colors, spacing, radius, fontSize, fontWeight]);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline, editable === false && styles.disabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}


