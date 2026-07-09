import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useHaptics } from '../hooks/useHaptics';
import { colors, spacing, radius, fontSize, fontWeight } from '../theme/tokens';

export default function LoginScreen({ navigation }: any) {
  const { light: hapticLight } = useHaptics();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email format';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Min 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Login failed. Check your credentials.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>💰</Text>
          <Text style={styles.title}>Finance Tracker</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <View style={styles.form}>
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
            placeholder="Enter your password"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            accessibilityLabel="Password"
          />
          {errors.password ? <Text style={styles.errorText} accessibilityLive="polite">{errors.password}</Text> : null}

          <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={() => { hapticLight(); handleLogin(); }} disabled={loading} accessibilityLabel="Sign in" accessibilityRole="button">
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => { hapticLight(); navigation.navigate('Register'); }} accessibilityLabel="Go to registration" accessibilityRole="button">
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkHighlight}>Sign Up</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
});
