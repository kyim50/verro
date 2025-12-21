import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = useAuthStore((state) => state.login);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(email, password);

    if (result.success) {
      router.replace('/(tabs)/home');
    } else {
      setError(result.error || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/auth/welcome')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log in</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Welcome to Verro</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email or Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Email or Username"
              placeholderTextColor={colors.text.disabled}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="default"
              editable={!loading}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor={colors.text.disabled}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => router.push('/auth/forgot-password')}
            style={styles.forgotPasswordContainer}
          >
            <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Log in</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Not on Verro yet? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/signup-flow')}>
              <Text style={styles.footerLink}>Sign up</Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <Text style={styles.termsText}>
            By continuing, you agree to Verro's{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and acknowledge
            you've read our{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  error: {
    color: colors.status.error,
    marginBottom: spacing.md,
    textAlign: 'center',
    ...typography.body,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  oauthButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
  },
  eyeButton: {
    padding: spacing.md,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  forgotPasswordText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#E60023',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  footerText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
  },
  footerLink: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});