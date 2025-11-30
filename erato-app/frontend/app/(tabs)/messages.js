import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../constants/theme';

export default function Screen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Coming Soon</Text>
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
  text: {
    ...typography.h2,
    color: colors.text.primary,
  },
});
