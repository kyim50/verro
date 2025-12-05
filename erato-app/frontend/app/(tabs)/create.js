import { useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors } from '../../constants/theme';

export default function CreateScreen() {
  useFocusEffect(
    useCallback(() => {
      // Navigate to upload screen when tab is focused
      const timeout = setTimeout(() => {
        router.push('/artwork/upload');
      }, 50);

      return () => clearTimeout(timeout);
    }, [])
  );

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
