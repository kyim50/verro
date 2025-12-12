import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { uploadImage } from '../utils/imageUpload';
import Toast from 'react-native-toast-message';

export default function DynamicForm({ formFields = [], initialValues = {}, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Initialize form data with initial values or empty values
    const initialData = {};
    formFields.forEach(field => {
      if (initialValues[field.id]) {
        initialData[field.id] = initialValues[field.id];
      } else if (field.type === 'checkbox') {
        initialData[field.id] = false;
      } else if (field.type === 'multiselect') {
        initialData[field.id] = [];
      } else {
        initialData[field.id] = '';
      }
    });
    setFormData(initialData);
  }, [formFields, initialValues]);

  const updateField = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    // Clear error when user starts typing
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const handleFileUpload = async (fieldId) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        setUploading(true);
        const uploadPromises = result.assets.map(asset => uploadImage(asset.uri));
        const uploadedUrls = await Promise.all(uploadPromises);
        
        const currentFiles = formData[fieldId] || [];
        updateField(fieldId, [...currentFiles, ...uploadedUrls]);
        
        Toast.show({
          type: 'success',
          text1: 'Files Uploaded',
          text2: `${result.assets.length} file(s) uploaded successfully`,
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: 'Failed to upload files',
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fieldId, index) => {
    const files = formData[fieldId] || [];
    updateField(fieldId, files.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};
    
    formFields.forEach(field => {
      const value = formData[field.id];
      
      if (field.required) {
        if (field.type === 'checkbox') {
          if (!value) {
            newErrors[field.id] = 'This field is required';
          }
        } else if (field.type === 'multiselect') {
          if (!value || value.length === 0) {
            newErrors[field.id] = 'Please select at least one option';
          }
        } else if (field.type === 'file') {
          if (!value || value.length === 0) {
            newErrors[field.id] = 'Please upload at least one file';
          }
        } else {
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            newErrors[field.id] = 'This field is required';
          }
        }
      }

      // Number validation
      if (field.type === 'number' && value) {
        const num = parseFloat(value);
        if (isNaN(num)) {
          newErrors[field.id] = 'Please enter a valid number';
        } else {
          if (field.validation?.min !== undefined && num < field.validation.min) {
            newErrors[field.id] = `Value must be at least ${field.validation.min}`;
          }
          if (field.validation?.max !== undefined && num > field.validation.max) {
            newErrors[field.id] = `Value must be at most ${field.validation.max}`;
          }
        }
      }

      // URL validation
      if (field.type === 'url' && value) {
        try {
          new URL(value);
        } catch {
          newErrors[field.id] = 'Please enter a valid URL';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    } else {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please fix the errors before submitting',
      });
    }
  };

  if (formFields.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="document-outline" size={48} color={colors.text.disabled} />
        <Text style={styles.emptyText}>No form fields configured</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {formFields.map((field) => (
        <FormField
          key={field.id}
          field={field}
          value={formData[field.id]}
          error={errors[field.id]}
          onChange={(value) => updateField(field.id, value)}
          onFileUpload={() => handleFileUpload(field.id)}
          onRemoveFile={(index) => removeFile(field.id, index)}
          uploading={uploading}
        />
      ))}

      <View style={styles.footer}>
        {onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function FormField({ field, value, error, onChange, onFileUpload, onRemoveFile, uploading }) {
  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'url':
        return (
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={value || ''}
            onChangeText={onChange}
            placeholder={field.placeholder || ''}
            placeholderTextColor={colors.text.disabled}
            keyboardType={field.type === 'url' ? 'url' : 'default'}
            autoCapitalize="none"
          />
        );

      case 'textarea':
        return (
          <TextInput
            style={[styles.textarea, error && styles.inputError]}
            value={value || ''}
            onChangeText={onChange}
            placeholder={field.placeholder || ''}
            placeholderTextColor={colors.text.disabled}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        );

      case 'number':
        return (
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={value?.toString() || ''}
            onChangeText={onChange}
            placeholder={field.placeholder || ''}
            placeholderTextColor={colors.text.disabled}
            keyboardType="numeric"
          />
        );

      case 'select':
        return (
          <SelectField
            field={field}
            value={value}
            onChange={onChange}
            error={error}
          />
        );

      case 'multiselect':
        return (
          <MultiSelectField
            field={field}
            value={value || []}
            onChange={onChange}
            error={error}
          />
        );

      case 'checkbox':
        return (
          <View style={styles.checkboxRow}>
            <Switch
              value={value || false}
              onValueChange={onChange}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.text.primary}
            />
            <Text style={styles.checkboxLabel}>{field.placeholder || 'Enable'}</Text>
          </View>
        );

      case 'radio':
        return (
          <RadioField
            field={field}
            value={value}
            onChange={onChange}
            error={error}
          />
        );

      case 'date':
        return (
          <DateField
            field={field}
            value={value}
            onChange={onChange}
            error={error}
          />
        );

      case 'file':
        return (
          <FileField
            field={field}
            value={value || []}
            onUpload={onFileUpload}
            onRemove={onRemoveFile}
            uploading={uploading}
            error={error}
          />
        );

      case 'color':
        return (
          <ColorField
            field={field}
            value={value}
            onChange={onChange}
            error={error}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>
          {field.label}
          {field.required && <Text style={styles.required}> *</Text>}
        </Text>
      </View>
      {renderField()}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

function SelectField({ field, value, onChange, error }) {
  const [showOptions, setShowOptions] = useState(false);

  const selectedOption = field.options?.find(opt => opt === value) || 'Select...';

  return (
    <View>
      <TouchableOpacity
        style={[styles.selectButton, error && styles.inputError]}
        onPress={() => setShowOptions(true)}
      >
        <Text style={[styles.selectText, !value && styles.selectPlaceholder]}>
          {selectedOption}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.text.secondary} />
      </TouchableOpacity>

      {showOptions && (
        <View style={styles.optionsContainer}>
          {field.options?.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                value === option && styles.optionSelected
              ]}
              onPress={() => {
                onChange(option);
                setShowOptions(false);
              }}
            >
              <Text style={[
                styles.optionText,
                value === option && styles.optionTextSelected
              ]}>
                {option}
              </Text>
              {value === option && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function MultiSelectField({ field, value, onChange, error }) {
  const toggleOption = (option) => {
    const current = value || [];
    if (current.includes(option)) {
      onChange(current.filter(opt => opt !== option));
    } else {
      onChange([...current, option]);
    }
  };

  return (
    <View style={styles.multiSelectContainer}>
      {field.options?.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.multiSelectOption,
            value?.includes(option) && styles.multiSelectOptionSelected
          ]}
          onPress={() => toggleOption(option)}
        >
          <Ionicons
            name={value?.includes(option) ? 'checkbox' : 'square-outline'}
            size={20}
            color={value?.includes(option) ? colors.primary : colors.text.secondary}
          />
          <Text style={[
            styles.multiSelectText,
            value?.includes(option) && styles.multiSelectTextSelected
          ]}>
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RadioField({ field, value, onChange, error }) {
  return (
    <View style={styles.radioContainer}>
      {field.options?.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={styles.radioOption}
          onPress={() => onChange(option)}
        >
          <Ionicons
            name={value === option ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={value === option ? colors.primary : colors.text.secondary}
          />
          <Text style={[
            styles.radioText,
            value === option && styles.radioTextSelected
          ]}>
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function DateField({ field, value, onChange, error }) {
  const handleDatePress = () => {
    // In a real app, you'd use a date picker library
    Alert.alert(
      'Date Picker',
      'Date picker functionality would be implemented here',
      [{ text: 'OK' }]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.input, error && styles.inputError]}
      onPress={handleDatePress}
    >
      <Text style={[styles.dateText, !value && styles.selectPlaceholder]}>
        {value || 'Select date'}
      </Text>
      <Ionicons name="calendar-outline" size={20} color={colors.text.secondary} />
    </TouchableOpacity>
  );
}

function FileField({ field, value, onUpload, onRemove, uploading, error }) {
  return (
    <View>
      <TouchableOpacity
        style={[styles.fileUploadButton, error && styles.inputError]}
        onPress={onUpload}
        disabled={uploading}
      >
        <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
        <Text style={styles.fileUploadText}>
          {uploading ? 'Uploading...' : 'Upload Files'}
        </Text>
      </TouchableOpacity>

      {value && value.length > 0 && (
        <View style={styles.fileList}>
          {value.map((url, index) => (
            <View key={index} style={styles.fileItem}>
              <Ionicons name="document-outline" size={20} color={colors.text.secondary} />
              <Text style={styles.fileUrl} numberOfLines={1}>
                {url.split('/').pop()}
              </Text>
              <TouchableOpacity onPress={() => onRemove(index)}>
                <Ionicons name="close-circle" size={20} color={colors.status.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ColorField({ field, value, onChange, error }) {
  const handleColorPress = () => {
    // In a real app, you'd use a color picker library
    Alert.alert(
      'Color Picker',
      'Color picker functionality would be implemented here',
      [{ text: 'OK' }]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.colorPickerButton, error && styles.inputError]}
      onPress={handleColorPress}
    >
      <View style={[styles.colorPreview, { backgroundColor: value || '#000000' }]} />
      <Text style={styles.colorText}>
        {value || 'Select color'}
      </Text>
      <Ionicons name="color-palette-outline" size={20} color={colors.text.secondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.disabled,
    marginTop: spacing.md,
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  fieldHeader: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
  },
  required: {
    color: colors.status.error,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.status.error,
  },
  textarea: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
  },
  errorText: {
    ...typography.caption,
    color: colors.status.error,
    marginTop: spacing.xs,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  selectPlaceholder: {
    color: colors.text.disabled,
  },
  optionsContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
  },
  optionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.primary + '20',
  },
  optionText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  multiSelectContainer: {
    gap: spacing.sm,
  },
  multiSelectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  multiSelectOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  multiSelectText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  multiSelectTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.text.primary,
  },
  radioContainer: {
    gap: spacing.sm,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  radioText: {
    ...typography.body,
    color: colors.text.primary,
  },
  radioTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  fileUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  fileUploadText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  fileList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  fileUrl: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  colorPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
  },
  submitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
});

