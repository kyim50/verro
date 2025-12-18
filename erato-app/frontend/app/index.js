import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store';
import { colors, typography, spacing } from '../constants/theme';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);
  const [checkingFirstLaunch, setCheckingFirstLaunch] = useState(true);

  useEffect(() => {
    checkFirstLaunch();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const hasLaunched = await AsyncStorage.getItem('hasLaunched');
      if (hasLaunched === null) {
        setIsFirstLaunch(true);
        try {
          await AsyncStorage.setItem('hasLaunched', 'true');
        } catch (setError) {
          console.warn('Failed to save first launch flag:', setError);
          // Don't crash - continue anyway
        }
      } else {
        setIsFirstLaunch(false);
      }
    } catch (error) {
      console.error('Error checking first launch:', error);
      // Default to not first launch if we can't check
      setIsFirstLaunch(false);
    } finally {
      setCheckingFirstLaunch(false);
    }
  };

  if (isLoading || checkingFirstLaunch) {
    return (
      <LinearGradient
        colors={[colors.background, colors.surfaceLight, colors.background]}
        style={styles.loadingContainer}
      >
        <View style={styles.loadingContent}>
          <Text style={styles.appName}>Verro</Text>
          <Text style={styles.tagline}>Discover. Create. Connect.</Text>
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        </View>
      </LinearGradient>
    );
  }

  // Show welcome screen for unauthenticated users
  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/auth/welcome" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    gap: spacing.md,
  },
  appName: {
    ...typography.h1,
    fontSize: 48,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  tagline: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.secondary,
    letterSpacing: 1,
    marginBottom: spacing.lg,
  },
  loader: {
    marginTop: spacing.xl,
  },
});
