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
    const initializeApp = async () => {
      const token = await loadToken();
      // Fetch user data with artists relationship if token exists
      if (token) {
        await fetchUser();
      }
    };
    initializeApp();
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
