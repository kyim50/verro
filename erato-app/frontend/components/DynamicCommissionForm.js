import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage, uploadMultipleImages } from '../utils/imageUpload';

/**
 * DynamicCommissionForm - Client-side form renderer
 * This component renders and handles submission of custom commission forms
 * created by artists using the FormBuilder
 */
const DynamicCommissionForm = ({ packageId, commissionId, onSubmit }) => {
  const [formFields, setFormFields] = useState([]);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadFormFields();
  }, [packageId]);

  const loadFormFields = async () => {
    try {
      const response = await fetch(`/api/form-builder/package/${packageId}`);
      const data = await response.json();
      if (data.success) {
        setFormFields(data.data.formFields || []);
        // Load existing responses if editing
        if (commissionId) {
          loadExistingResponses();
        }
      }
    } catch (error) {
      console.error('Error loading form:', error);
      Alert.alert('Error', 'Failed to load commission form');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingResponses = async () => {
    try {
      const response = await fetch(`/api/form-builder/commission/${commissionId}/responses`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setResponses(data.data.responses || {});
      }
    } catch (error) {
      console.error('Error loading responses:', error);
    }
  };

  const handleChange = (fieldId, value) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }));
    // Clear error for this field
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const handleFileUpload = async (fieldId, field) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: field.maxFiles > 1,
        quality: 0.8,
      });

      if (!result.canceled) {
        const files = result.assets || [result];

        if (files.length > (field.maxFiles || 5)) {
          Alert.alert('Too Many Files', `Maximum ${field.maxFiles || 5} files allowed`);
          return;
        }

        // Upload files
        const uploadPromises = files.map(file => uploadImage(file.uri));
        const urls = await Promise.all(uploadPromises);

        handleChange(fieldId, urls);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      Alert.alert('Upload Error', 'Failed to upload files');
    }
  };

  const validateForm = () => {
    const newErrors = {};

    for (const field of formFields) {
      const value = responses[field.id];

      // Required field validation
      if (field.required && (!value || value === '' || (Array.isArray(value) && value.length === 0))) {
        newErrors[field.id] = `${field.label} is required`;
        continue;
      }

      // Type-specific validation
      if (value) {
        switch (field.type) {
          case 'number':
            if (isNaN(value)) {
              newErrors[field.id] = `${field.label} must be a number`;
            } else if (field.min !== undefined && value < field.min) {
              newErrors[field.id] = `${field.label} must be at least ${field.min}`;
            } else if (field.max !== undefined && value > field.max) {
              newErrors[field.id] = `${field.label} must be at most ${field.max}`;
            }
            break;

          case 'url':
            try {
              new URL(value);
            } catch {
              newErrors[field.id] = `${field.label} must be a valid URL`;
            }
            break;

          case 'file':
            if (Array.isArray(value) && field.maxFiles && value.length > field.maxFiles) {
              newErrors[field.id] = `Maximum ${field.maxFiles} files allowed`;
            }
            break;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/form-builder/commission/${commissionId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ responses }),
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Form submitted successfully!');
        onSubmit && onSubmit(responses);
      } else {
        Alert.alert('Error', data.error || 'Failed to submit form');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit form');
      console.error('Error submitting form:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const value = responses[field.id];
    const error = errors[field.id];

    // Check conditional display
    if (field.conditional) {
      const conditionValue = responses[field.conditional.field];
      if (conditionValue !== field.conditional.value) {
        return null; // Hide field if condition not met
      }
    }

    return (
      <View key={field.id} style={styles.fieldContainer}>
        <Text style={styles.label}>
          {field.label}
          {field.required && <Text style={styles.required}> *</Text>}
        </Text>

        {field.helpText && (
          <Text style={styles.helpText}>{field.helpText}</Text>
        )}

        {/* Text Input */}
        {field.type === 'text' && (
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={value || ''}
            onChangeText={(text) => handleChange(field.id, text)}
            placeholder={field.placeholder}
          />
        )}

        {/* Textarea */}
        {field.type === 'textarea' && (
          <TextInput
            style={[styles.input, styles.textArea, error && styles.inputError]}
            value={value || ''}
            onChangeText={(text) => handleChange(field.id, text)}
            placeholder={field.placeholder}
            multiline
            numberOfLines={field.rows || 4}
          />
        )}

        {/* Number Input */}
        {field.type === 'number' && (
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={value ? String(value) : ''}
            onChangeText={(text) => handleChange(field.id, Number(text))}
            placeholder={field.placeholder}
            keyboardType="numeric"
          />
        )}

        {/* Date Input */}
        {field.type === 'date' && (
          <TouchableOpacity
            style={[styles.input, styles.dateInput]}
            onPress={() => {
              // In production, use DateTimePicker
              Alert.alert('Date Picker', 'Date picker would open here');
            }}
          >
            <Text>{value || 'Select date...'}</Text>
            <Ionicons name="calendar-outline" size={20} color="#666" />
          </TouchableOpacity>
        )}

        {/* URL Input */}
        {field.type === 'url' && (
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={value || ''}
            onChangeText={(text) => handleChange(field.id, text)}
            placeholder={field.placeholder || 'https://example.com'}
            keyboardType="url"
            autoCapitalize="none"
          />
        )}

        {/* Checkbox */}
        {field.type === 'checkbox' && (
          <View style={styles.checkboxContainer}>
            <Switch
              value={value || false}
              onValueChange={(val) => handleChange(field.id, val)}
            />
            <Text style={styles.checkboxLabel}>{field.label}</Text>
          </View>
        )}

        {/* Select/Dropdown */}
        {field.type === 'select' && (
          <View style={styles.selectContainer}>
            {field.options?.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.selectOption,
                  value === option && styles.selectOptionActive,
                ]}
                onPress={() => handleChange(field.id, option)}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    value === option && styles.selectOptionTextActive,
                  ]}
                >
                  {option}
                </Text>
                {value === option && (
                  <Ionicons name="checkmark-circle" size={20} color="#3498db" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Multi-select */}
        {field.type === 'multiselect' && (
          <View style={styles.selectContainer}>
            {field.options?.map((option, index) => {
              const isSelected = Array.isArray(value) && value.includes(option);
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.selectOption,
                    isSelected && styles.selectOptionActive,
                  ]}
                  onPress={() => {
                    const currentValue = Array.isArray(value) ? value : [];
                    const newValue = isSelected
                      ? currentValue.filter(v => v !== option)
                      : [...currentValue, option];
                    handleChange(field.id, newValue);
                  }}
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      isSelected && styles.selectOptionTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color="#3498db" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Radio Buttons */}
        {field.type === 'radio' && (
          <View style={styles.radioContainer}>
            {field.options?.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.radioOption}
                onPress={() => handleChange(field.id, option)}
              >
                <View style={styles.radioCircle}>
                  {value === option && <View style={styles.radioCircleFilled} />}
                </View>
                <Text style={styles.radioLabel}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* File Upload */}
        {field.type === 'file' && (
          <View>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => handleFileUpload(field.id, field)}
            >
              <Ionicons name="cloud-upload-outline" size={24} color="#3498db" />
              <Text style={styles.uploadButtonText}>
                Upload Files ({Array.isArray(value) ? value.length : 0}/{field.maxFiles || 5})
              </Text>
            </TouchableOpacity>
            {Array.isArray(value) && value.length > 0 && (
              <View style={styles.fileList}>
                {value.map((url, index) => (
                  <View key={index} style={styles.fileItem}>
                    <Ionicons name="document-outline" size={16} color="#666" />
                    <Text style={styles.fileName} numberOfLines={1}>
                      File {index + 1}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        const newValue = value.filter((_, i) => i !== index);
                        handleChange(field.id, newValue);
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Color Picker */}
        {field.type === 'color' && (
          <TouchableOpacity
            style={[styles.colorPicker, { backgroundColor: value || '#fff' }]}
            onPress={() => {
              // In production, use color picker library
              Alert.alert('Color Picker', 'Color picker would open here');
            }}
          >
            <Text>{value || 'Select color...'}</Text>
          </TouchableOpacity>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#e74c3c" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading form...</Text>
      </View>
    );
  }

  if (formFields.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={48} color="#ccc" />
        <Text style={styles.emptyText}>No custom form for this package</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Commission Details</Text>
      <Text style={styles.subtitle}>
        Please fill out all required fields marked with *
      </Text>

      {formFields.map(renderField)}

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitButtonText}>
          {submitting ? 'Submitting...' : 'Submit Form'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    color: '#999',
    fontSize: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  fieldContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  required: {
    color: '#e74c3c',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxLabel: {
    fontSize: 14,
  },
  selectContainer: {
    gap: 8,
  },
  selectOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectOptionActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#3498db',
  },
  selectOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectOptionTextActive: {
    color: '#3498db',
    fontWeight: '600',
  },
  radioContainer: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleFilled: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3498db',
  },
  radioLabel: {
    fontSize: 14,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3498db',
    borderStyle: 'dashed',
    gap: 8,
  },
  uploadButtonText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
  },
  fileList: {
    marginTop: 12,
    gap: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
  colorPicker: {
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DynamicCommissionForm;
