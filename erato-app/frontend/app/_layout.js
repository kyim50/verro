import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store';

export default function RootLayout() {
  const loadToken = useAuthStore((state) => state.loadToken);
  const fetchUser = useAuthStore((state) => state.fetchUser);

  useEffect(() => {
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'fade',
        }}
      />
      <Toast />
    </GestureHandlerRootView>
  );
}
