import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';
import { useAuthStore } from '../store';
import LoadingScreen from './auth/loading';

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const loadToken = useAuthStore((state) => state.loadToken);
  const fetchUser = useAuthStore((state) => state.fetchUser);

  useEffect(() => {
    // Debug: Log API URLs being used
    const apiURL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
    const socketURL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SOCKET_URL || process.env.EXPO_PUBLIC_SOCKET_URL;
    console.log('🔍 API URL:', apiURL);
    console.log('🔍 Socket URL:', socketURL);
    console.log('🔍 Constants.expoConfig.extra:', Constants.expoConfig?.extra);

    let mounted = true;
    const initializeApp = async () => {
      try {
        if (!mounted) return;
        const token = await loadToken();
        // Fetch user data with artists relationship if token exists
        if (token && mounted) {
          try {
            await fetchUser();
          } catch (error) {
            // fetchUser will handle clearing invalid tokens
            console.log('Failed to fetch user, token may be invalid:', error);
          }
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        if (mounted) {
          // Show loading screen for at least 1.5 seconds
          setTimeout(() => {
            if (mounted) {
              setIsLoading(false);
            }
          }, 1500);
        }
      }
    };
    // Delay initialization slightly to ensure everything is mounted
    setTimeout(() => {
      if (mounted) {
        initializeApp();
      }
    }, 100);
    
    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'fade',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          animationDuration: 200,
          fullScreenGestureEnabled: false, // Prevent full screen swipe that can cause logout
        }}
      />
      <Toast />
    </GestureHandlerRootView>
  );
}
