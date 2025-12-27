import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';
import { useAuthStore } from '../store';
import ErrorBoundary from '../components/ErrorBoundary';
import toastConfig from '../components/StyledToast';
import StyledAlert, { showAlert } from '../components/StyledAlert';
import { colors } from '../constants/theme';

// Patch Toast.show globally to use the styled alert (smaller, consistent)
let toastPatched = false;
function patchToastToAlert() {
  if (toastPatched) return;
  const originalShow = Toast.show?.bind(Toast);
  Toast.show = (options = {}) => {
    const { type = 'info', text1 = 'Notice', text2 = '', visibilityTime } = options || {};
    const safeType = type === 'error' ? 'error' : type === 'success' ? 'success' : 'info';
    showAlert({
      title: text1 || 'Notice',
      message: text2 || '',
      type: safeType,
      duration: visibilityTime || 2500,
    });
    // Keep the original behavior in dev if needed
    // Temporarily disabled to test StyledAlert
    // if (__DEV__ && originalShow) {
    //   originalShow(options);
    // }
  };
  toastPatched = true;
}

export default function RootLayout() {
  const loadToken = useAuthStore((state) => state.loadToken);
  const fetchUser = useAuthStore((state) => state.fetchUser);

  useEffect(() => {
    patchToastToAlert();
    // Set up global error handlers FIRST - before anything else
    const errorHandler = (error, isFatal) => {
      console.error('🚨 Global error:', error, 'Fatal:', isFatal);
      // Log to console for debugging
      if (__DEV__) {
        console.error('Error stack:', error?.stack);
        console.error('Error message:', error?.message);
      }
      // Don't crash on non-fatal errors
      if (isFatal) {
        console.error('🚨 Fatal error occurred:', error);
      }
    };

    // Handle unhandled promise rejections
    if (typeof Promise !== 'undefined' && Promise.reject) {
      const originalRejection = Promise.reject;
      // Note: Can't override Promise.reject easily, but we can catch in our code
    }

    // Set up error handlers
    if (typeof ErrorUtils !== 'undefined' && ErrorUtils.setGlobalHandler) {
      const originalHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((error, isFatal) => {
        errorHandler(error, isFatal);
        if (originalHandler) {
          try {
            originalHandler(error, isFatal);
          } catch (e) {
            console.error('Original error handler failed:', e);
          }
        }
      });
    }

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
            // Don't crash - continue without user data
          }
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        // Don't crash - continue anyway
      }
    };
    // Initialize app immediately without loading screen
    initializeApp();

    return () => {
      mounted = false;
    };
  }, []);

  const stripePublishableKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  return (
    <ErrorBoundary>
      <StripeProvider publishableKey={stripePublishableKey || ''}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar barStyle="light-content" backgroundColor={colors.background} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'fade',
              gestureEnabled: true,
              gestureDirection: 'horizontal',
              animationDuration: 100, // Shorter transitions
              fullScreenGestureEnabled: false, // Prevent full screen swipe that can cause logout
            }}
          >
            <Stack.Screen
              name="auth/login"
              options={{
                gestureEnabled: false, // Disable swipe back on login
                animation: 'fade',
                animationDuration: 100, // Shorter transition for logout
              }}
            />
            <Stack.Screen
              name="auth/register"
              options={{
                gestureEnabled: false, // Disable swipe back on register
              }}
            />
            <Stack.Screen
              name="auth/profile-picture"
              options={{
                gestureEnabled: false, // Disable swipe back on profile picture
              }}
            />
            <Stack.Screen
              name="(tabs)"
              options={{
                gestureEnabled: false, // Disable swipe back from tabs to auth
              }}
            />
          </Stack>
          <Toast
            config={toastConfig}
            topOffset={60}
            visibilityTime={3000}
          />
          <StyledAlert />
        </GestureHandlerRootView>
      </StripeProvider>
    </ErrorBoundary>
  );
}
