import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    fullName: '',
    userType: 'client', // 'client', 'artist', or 'both'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const register = useAuthStore((state) => state.register);

  const handleRegister = async () => {
    if (!formData.email || !formData.username || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    const result = await register(formData);

    if (result.success) {
      router.replace('/(tabs)/home');
    } else {
      setError(result.error || 'Registration failed');
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>Verro</Text>
            <Text style={styles.tagline}>Join the Art Community</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput
              style={styles.input}
              placeholder="Email *"
              placeholderTextColor={colors.text.disabled}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />

            <TextInput
              style={styles.input}
              placeholder="Username *"
              placeholderTextColor={colors.text.disabled}
              value={formData.username}
              onChangeText={(text) => setFormData({ ...formData, username: text })}
              autoCapitalize="none"
              editable={!loading}
            />

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={colors.text.disabled}
              value={formData.fullName}
              onChangeText={(text) => setFormData({ ...formData, fullName: text })}
              editable={!loading}
            />

            <TextInput
              style={styles.input}
              placeholder="Password *"
              placeholderTextColor={colors.text.disabled}
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              secureTextEntry
              editable={!loading}
            />

            {/* User Type Selection */}
            <Text style={styles.label}>I am a:</Text>
            <View style={styles.typeContainer}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.userType === 'client' && styles.typeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, userType: 'client' })}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.typeText,
                    formData.userType === 'client' && styles.typeTextActive,
                  ]}
                >
                  Client
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.userType === 'artist' && styles.typeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, userType: 'artist' })}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.typeText,
                    formData.userType === 'artist' && styles.typeTextActive,
                  ]}
                >
                  Artist
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  formData.userType === 'both' && styles.typeButtonActive,
                ]}
                onPress={() => setFormData({ ...formData, userType: 'both' })}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.typeText,
                    formData.userType === 'both' && styles.typeTextActive,
                  ]}
                >
                  Both
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.link}>Log In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.body,
    color: colors.text.secondary,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    color: colors.text.primary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  typeButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  typeText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  typeTextActive: {
    color: colors.text.primary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  error: {
    color: colors.status.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  link: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});