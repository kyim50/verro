import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../constants/theme';

let alertInstance = null;

export const showAlert = ({ title, message, type = 'info', onPress, duration }) => {
  if (alertInstance && alertInstance.show) {
    alertInstance.show({ title, message, type, onPress, duration });
  } else {
    // Fallback: log error if alert instance not ready
    console.warn('StyledAlert instance not ready. Title:', title, 'Message:', message);
  }
};

const showAlertInternal = (setVisible, setAlertData, timerRef) => (data) => {
  // Always provide fallbacks to avoid empty alerts
  const safeData = {
    title: data?.title || 'Notice',
    message: data?.message || '',
    type: data?.type || 'info',
    onPress: data?.onPress,
    duration: data?.duration || 2500,
  };
  
  // Clear any existing timer
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
  
  setAlertData(safeData);
  setVisible(true);

  // Auto-dismiss after duration to prevent UI blocking
  timerRef.current = setTimeout(() => {
    setVisible(false);
    setTimeout(() => setAlertData(null), 250);
  }, safeData.duration);
};

const StyledAlert = forwardRef((props, ref) => {
  const [visible, setVisible] = React.useState(false);
  const [alertData, setAlertData] = React.useState(null);
  const timerRef = React.useRef(null);

  useImperativeHandle(ref, () => ({
    show: showAlertInternal(setVisible, setAlertData, timerRef),
  }));

  React.useEffect(() => {
    alertInstance = {
      show: showAlertInternal(setVisible, setAlertData, timerRef),
    };
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    if (alertData?.onPress) {
      alertData.onPress();
    }
    setTimeout(() => setAlertData(null), 300);
  };

  // Don't render modal if not visible - prevents blocking overlay
  if (!visible || !alertData) return null;

  const { title, message, type } = alertData;
  const iconMap = {
    success: { name: 'checkmark-circle', color: colors.status.success },
    error: { name: 'close-circle', color: colors.status.error },
    info: { name: 'information-circle', color: colors.status.info },
  };
  const icon = iconMap[type] || iconMap.info;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay} pointerEvents="box-none">
          <TouchableWithoutFeedback>
            <View style={styles.alertContainer}>
              <View style={styles.alertContent}>
                <Ionicons name={icon.name} size={24} color={icon.color} style={styles.icon} />
                {title && <Text style={styles.title}>{title}</Text>}
                {message && <Text style={styles.message}>{message}</Text>}
                <TouchableOpacity style={styles.button} onPress={handleClose}>
                  <Text style={styles.buttonText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

StyledAlert.displayName = 'StyledAlert';

export default StyledAlert;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  alertContainer: {
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
  },
  alertContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    width: '100%',
    alignItems: 'center',
    ...shadows.medium,
    elevation: 6,
  },
  icon: {
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
    paddingHorizontal: spacing.xs,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
