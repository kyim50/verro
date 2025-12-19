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

export const showAlert = ({
  title,
  message,
  type = 'info',
  onPress,
  duration,
  buttons,
  showCancel = false,
  onConfirm,
  cancelText = 'Cancel',
  confirmText = 'Confirm'
}) => {
  if (alertInstance && alertInstance.show) {
    // If showCancel is true, automatically create buttons
    let finalButtons = buttons;
    if (showCancel && onConfirm && !buttons) {
      finalButtons = [
        { text: cancelText, style: 'cancel', onPress: () => {} },
        { text: confirmText, style: type === 'error' ? 'destructive' : 'default', onPress: onConfirm },
      ];
    }

    alertInstance.show({ title, message, type, onPress, duration, buttons: finalButtons });
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
    buttons: data?.buttons || null,
  };

  // Clear any existing timer
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  setAlertData(safeData);
  setVisible(true);

  // Auto-dismiss after duration only if no custom buttons (confirmations should stay)
  if (!safeData.buttons) {
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setAlertData(null), 250);
    }, safeData.duration);
  }
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

  const { title, message, type, buttons } = alertData;
  const iconMap = {
    success: { name: 'checkmark-circle', color: colors.status.success },
    error: { name: 'close-circle', color: colors.status.error },
    warning: { name: 'warning', color: colors.status.warning },
    info: { name: 'information-circle', color: colors.status.info },
  };
  const icon = iconMap[type] || iconMap.info;

  const handleButtonPress = (button) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    if (button.onPress) {
      button.onPress();
    }
    setTimeout(() => setAlertData(null), 300);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={buttons ? null : handleClose}>
        <View style={styles.overlay} pointerEvents="box-none">
          <TouchableWithoutFeedback>
            <View style={styles.alertContainer}>
              <View style={styles.alertContent}>
                <Ionicons name={icon.name} size={22} color={icon.color} style={styles.icon} />
                {title && <Text style={styles.title}>{title}</Text>}
                {message && <Text style={styles.message}>{message}</Text>}
                {buttons ? (
                  <View style={styles.buttonsContainer}>
                    {buttons.map((button, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.button,
                          button.style === 'cancel' && styles.cancelButton,
                          button.style === 'destructive' && styles.destructiveButton,
                        ]}
                        onPress={() => handleButtonPress(button)}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            button.style === 'cancel' && styles.cancelButtonText,
                            button.style === 'destructive' && styles.destructiveButtonText,
                          ]}
                        >
                          {button.text}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.singleButton} onPress={handleClose}>
                    <Text style={styles.buttonText}>OK</Text>
                  </TouchableOpacity>
                )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  alertContainer: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  alertContent: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
    ...shadows.large,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  button: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  singleButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  destructiveButton: {
    backgroundColor: colors.status.error,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButtonText: {
    color: colors.text.primary,
  },
  destructiveButtonText: {
    color: '#FFFFFF',
  },
});
