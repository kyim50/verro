import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ||
                process.env.EXPO_PUBLIC_API_URL ||
                'https://api.verrocio.com/api';

const STEPS = {
  EMAIL: 0,
  PASSWORD: 1,
  DOB: 2,
  USERNAME: 3,
  USER_TYPE: 4,
};

// Simple input state management
const useInputState = () => {
  const [inputsEnabled, setInputsEnabled] = useState(true);
  return { inputsEnabled, setInputsEnabled };
};

export default function SignupFlowScreen() {
  const [currentStep, setCurrentStep] = useState(STEPS.EMAIL);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    dob: '',
    username: '',
    fullName: '',
    userType: 'client',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const { inputsEnabled } = useInputState();

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const register = useAuthStore((state) => state.register);

  // Check if email exists
  const checkEmailAvailability = async (email) => {
    try {
      setCheckingEmail(true);
      // Try to register with just email to check if it exists
      // This is a lightweight check - we'll catch the error if email exists
      const response = await axios.post(`${API_URL}/auth/check-email`, {
        email,
      }, {
        timeout: 5000,
      });
      return response.data.available !== false;
    } catch (error) {
      // If endpoint doesn't exist (404) or any other error, skip check
      // Backend will validate on actual registration
      if (error.response?.status === 404) {
        console.log('Email check endpoint not available, skipping check');
        return true;
      }
      // If we get a specific error about email existing, catch it
      if (error.response?.data?.error?.toLowerCase().includes('email')) {
        return false;
      }
      // For other errors, allow to proceed (backend will catch it)
      return true;
    } finally {
      setCheckingEmail(false);
    }
  };

  // Animate step transitions
  useEffect(() => {
    // Reset animation values for new step
    fadeAnim.setValue(0);

    // Simple fade-in animation without transforms that might block touches
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentStep]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateDOB = (dob) => {
    // Format: MM/DD/YYYY
    const dobRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    if (!dobRegex.test(dob)) return false;

    // Check if user is at least 13 years old
    const [month, day, year] = dob.split('/').map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1 >= 13;
    }
    return age >= 13;
  };

  const handleNext = async () => {
    setError('');

    // Validate before animation
    let hasError = false;
    switch (currentStep) {
      case STEPS.EMAIL:
        if (!formData.email) {
          setError('Please enter your email');
          hasError = true;
        } else if (!validateEmail(formData.email)) {
          setError('Please enter a valid email');
          hasError = true;
        } else {
          // Check if email is available
          const isAvailable = await checkEmailAvailability(formData.email);
          if (!isAvailable) {
            setError('This email is already registered. Please log in or use a different email.');
            hasError = true;
          }
        }
        break;

      case STEPS.PASSWORD:
        if (!formData.password) {
          setError('Please create a password');
          hasError = true;
        } else if (formData.password.length < 8) {
          setError('Password must be at least 8 characters');
          hasError = true;
        }
        break;

      case STEPS.DOB:
        if (!formData.dob) {
          setError('Please enter your date of birth');
          hasError = true;
        } else if (!validateDOB(formData.dob)) {
          setError('Invalid date of birth or you must be at least 13 years old');
          hasError = true;
        }
        break;

      case STEPS.USERNAME:
        if (!formData.username) {
          setError('Please enter a username');
          hasError = true;
        } else if (formData.username.length < 3) {
          setError('Username must be at least 3 characters');
          hasError = true;
        }
        break;
    }

    if (hasError) return;

    // Fade out before transition
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Reset animation values for next step
      fadeAnim.setValue(0);

      if (currentStep < STEPS.USER_TYPE) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSignup();
      }
    });
  };

  const handleBack = () => {
    setError('');
    if (currentStep > STEPS.EMAIL) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    setError('');

    try {
      // Convert DOB from MM/DD/YYYY to ISO format
      let dobISO = null;
      if (formData.dob) {
        const [month, day, year] = formData.dob.split('/').map(Number);
        dobISO = new Date(year, month - 1, day).toISOString();
      }

      const result = await register({
        ...formData,
        dob: dobISO,
        avatar_url: '',
      });

      if (result.success) {
        router.replace(`/auth/profile-picture?userType=${formData.userType}`);
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressDots = () => {
    const totalSteps = Object.keys(STEPS).length;
    return (
      <View style={styles.progressContainer}>
        {[...Array(totalSteps)].map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index === currentStep && styles.progressDotActive,
              index < currentStep && styles.progressDotCompleted,
            ]}
          />
        ))}
      </View>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.EMAIL:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What's your email?</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.text.disabled}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
              editable={!loading}
            />
          </View>
        );

      case STEPS.PASSWORD:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Create a password</Text>
            <Text style={styles.stepSubtitle}>
              Use at least 8 characters with a mix of letters, numbers, and symbols
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor={colors.text.disabled}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry={!showPassword}
                autoFocus
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
        );

      case STEPS.DOB:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What's your date of birth?</Text>
            <Text style={styles.stepSubtitle}>
              We need this for age verification (NSFW content)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={colors.text.disabled}
              value={formData.dob}
              onChangeText={(text) => {
                // Auto-format date as user types
                let formatted = text.replace(/[^\d]/g, '');
                if (formatted.length >= 2) {
                  formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
                }
                if (formatted.length >= 5) {
                  formatted = formatted.slice(0, 5) + '/' + formatted.slice(5, 9);
                }
                setFormData({ ...formData, dob: formatted });
              }}
              keyboardType="numeric"
              maxLength={10}
              autoFocus
              editable={!loading}
            />
          </View>
        );

        case STEPS.USERNAME:
          return (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Choose a username</Text>
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={colors.text.disabled}
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                autoCapitalize="none"
                autoFocus
                editable={!loading}
              />
            </View>
          );

      case STEPS.USER_TYPE:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>I am a:</Text>
            <TouchableOpacity
              style={[
                styles.userTypeButton,
                formData.userType === 'client' && styles.userTypeButtonActive,
              ]}
              onPress={() => setFormData({ ...formData, userType: 'client' })}
              activeOpacity={0.8}
            >
              <View style={styles.userTypeContent}>
                <Ionicons
                  name="person-outline"
                  size={24}
                  color={formData.userType === 'client' ? '#FFFFFF' : colors.text.primary}
                />
                <View style={styles.userTypeTextContainer}>
                  <Text style={[
                    styles.userTypeTitle,
                    formData.userType === 'client' && styles.userTypeTextActive
                  ]}>
                    Client
                  </Text>
                  <Text style={[
                    styles.userTypeSubtitle,
                    formData.userType === 'client' && styles.userTypeTextActive
                  ]}>
                    Looking to commission artists
                  </Text>
                </View>
              </View>
              {formData.userType === 'client' && (
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.userTypeButton,
                formData.userType === 'artist' && styles.userTypeButtonActive,
              ]}
              onPress={() => setFormData({ ...formData, userType: 'artist' })}
              activeOpacity={0.8}
            >
              <View style={styles.userTypeContent}>
                <Ionicons
                  name="brush-outline"
                  size={24}
                  color={formData.userType === 'artist' ? '#FFFFFF' : colors.text.primary}
                />
                <View style={styles.userTypeTextContainer}>
                  <Text style={[
                    styles.userTypeTitle,
                    formData.userType === 'artist' && styles.userTypeTextActive
                  ]}>
                    Artist
                  </Text>
                  <Text style={[
                    styles.userTypeSubtitle,
                    formData.userType === 'artist' && styles.userTypeTextActive
                  ]}>
                    Creating and selling artwork
                  </Text>
                </View>
              </View>
              {formData.userType === 'artist' && (
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sign up</Text>
        </View>

        {/* Progress Dots */}
        {renderProgressDots()}

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
            }
          ]}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {renderStepContent()}
        </Animated.View>

        {/* Next Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextButton, (loading || checkingEmail) && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={loading || checkingEmail}
            activeOpacity={0.9}
          >
            {(loading || checkingEmail) ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.nextButtonText}>
                {currentStep === STEPS.USER_TYPE ? 'Complete' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>

          {currentStep === STEPS.EMAIL && (
            <View style={styles.loginLinkContainer}>
              <Text style={styles.loginText}>Already a member? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/login')}>
                <Text style={styles.loginLink}>Log in</Text>
              </TouchableOpacity>
            </View>
          )}
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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: '#E60023',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressDotCompleted: {
    backgroundColor: '#E60023',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  stepContainer: {
    gap: spacing.md,
  },
  stepTitle: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: spacing.md,
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
    marginBottom: spacing.md,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
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
  userTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  userTypeButtonActive: {
    backgroundColor: '#E60023',
    borderColor: '#E60023',
  },
  userTypeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  userTypeTextContainer: {
    flex: 1,
  },
  userTypeTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  userTypeSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 14,
  },
  userTypeTextActive: {
    color: '#FFFFFF',
  },
  error: {
    color: colors.status.error,
    marginBottom: spacing.md,
    textAlign: 'center',
    ...typography.body,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
  nextButton: {
    backgroundColor: '#E60023',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  loginText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
  },
  loginLink: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
