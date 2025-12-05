import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store';
import { colors } from '../constants/theme';

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
        await AsyncStorage.setItem('hasLaunched', 'true');
      } else {
        setIsFirstLaunch(false);
      }
    } catch (error) {
      console.error('Error checking first launch:', error);
      setIsFirstLaunch(false);
    } finally {
      setCheckingFirstLaunch(false);
    }
  };

  if (isLoading || checkingFirstLaunch) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show intro on first launch (unless already authenticated)
  if (isFirstLaunch && !isAuthenticated) {
    return <Redirect href="/onboarding/intro" />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/auth/login" />;
}
