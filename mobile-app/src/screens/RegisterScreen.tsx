import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useHaptics } from '../hooks/useHaptics';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radius, fontSize, fontWeight } from '../theme/tokens';

export default function RegisterScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.xxxl },
  logo: { fontSize: 64, marginBottom: spacing.md },
  title: { fontSize: fontSize.xxl + 4, fontWeight: fontWeight.bold, color: colors.text },
  subtitle: { fontSize: fontSize.base, color: colors.slate500, marginTop: spacing.xs },
  form: { width: '100%' },
  label: { fontSize: fontSize.base - 1, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.sm },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg - 2, fontSize: fontSize.base + 1, color: colors.text, marginBottom: spacing.xs },
  inputError: { borderColor: colors.error },
  errorText: { fontSize: fontSize.xs + 1, color: colors.error, marginBottom: spacing.sm, marginLeft: spacing.xs },
  button: { backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg },
  buttonText: { color: colors.textInverse, fontSize: fontSize.base + 1, fontWeight: fontWeight.semibold },
  linkBtn: { marginTop: spacing.xl, alignItems: 'center' },
  linkText: { fontSize: fontSize.sm + 1, color: colors.slate500 },
  linkHighlight: { color: colors.primary, fontWeight: fontWeight.semibold },
}), [colors, spacing, radius, fontSize, fontWeight]);
  const { light: hapticLight } = useHaptics();
  const { register } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email format';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Min 8 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(email.trim(), password, fullName.trim());
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Registration failed. Try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>💰</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start tracking your finances</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            value={fullName}
            onChangeText={(t) => { setFullName(t); setErrors((e) => ({ ...e, fullName: '' })); }}
            placeholder="John Doe"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="words"
            accessibilityLabel="Full name"
          />
          {errors.fullName ? <Text style={styles.errorText} accessibilityLive="polite">{errors.fullName}</Text> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            value={email}
            onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })); }}
            placeholder="you@example.com"
            placeholderTextColor={colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email address"
          />
          {errors.email ? <Text style={styles.errorText} accessibilityLive="polite">{errors.email}</Text> : null}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, errors.password && styles.inputError]}
            value={password}
            onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }}
            placeholder="Min 8 characters"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            accessibilityLabel="Password"
          />
          {errors.password ? <Text style={styles.errorText} accessibilityLive="polite">{errors.password}</Text> : null}

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={[styles.input, errors.confirmPassword && styles.inputError]}
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setErrors((e) => ({ ...e, confirmPassword: '' })); }}
            placeholder="Re-enter password"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            accessibilityLabel="Confirm password"
          />
          {errors.confirmPassword ? <Text style={styles.errorText} accessibilityLive="polite">{errors.confirmPassword}</Text> : null}

          <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={() => { hapticLight(); handleRegister(); }} disabled={loading} accessibilityLabel="Create account" accessibilityRole="button">
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => { hapticLight(); navigation.goBack(); }} accessibilityLabel="Go back to sign in" accessibilityRole="button">
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkHighlight}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

