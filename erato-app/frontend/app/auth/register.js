import { useEffect } from 'react';
import { router } from 'expo-router';

// Redirect to new signup flow
export default function RegisterScreen() {
  useEffect(() => {
    router.replace('/auth/signup-flow');
  }, []);

  return null;
}