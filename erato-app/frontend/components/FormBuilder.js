import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Switch,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius, components } from '../constants/theme';

const FIELD_TYPES = [
  { id: 'text', label: 'Text Input', icon: 'text-outline' },
  { id: 'textarea', label: 'Text Area', icon: 'document-text-outline' },
  { id: 'number', label: 'Number', icon: 'calculator-outline' },
  { id: 'select', label: 'Dropdown', icon: 'chevron-down-outline' },
  { id: 'multiselect', label: 'Multi-Select', icon: 'checkbox-outline' },
  { id: 'checkbox', label: 'Checkbox', icon: 'square-outline' },
  { id: 'radio', label: 'Radio Buttons', icon: 'radio-button-on-outline' },
  { id: 'date', label: 'Date Picker', icon: 'calendar-outline' },
  { id: 'file', label: 'File Upload', icon: 'attach-outline' },
  { id: 'color', label: 'Color Picker', icon: 'color-palette-outline' },
  { id: 'url', label: 'URL', icon: 'link-outline' },
];

const TEMPLATES = {
  basic: {
    name: 'Basic Commission',
    fields: [
      { id: '1', type: 'textarea', label: 'Description', required: true, placeholder: 'Describe what you want...' },
      { id: '2', type: 'date', label: 'Deadline', required: false },
      { id: '3', type: 'file', label: 'Reference Images', required: false },
    ],
  },
  character: {
    name: 'Character Design',
    fields: [
      { id: '1', type: 'text', label: 'Character Name', required: true },
      { id: '2', type: 'select', label: 'Character Type', required: true, options: ['Human', 'Animal', 'Fantasy', 'Robot', 'Other'] },
      { id: '3', type: 'text', label: 'Gender', required: false },
      { id: '4', type: 'textarea', label: 'Pose & Expression', required: false },
      { id: '5', type: 'textarea', label: 'Outfit Description', required: false },
      { id: '6', type: 'color', label: 'Color Scheme', required: false },
      { id: '7', type: 'file', label: 'Reference Images', required: false },
    ],
  },
  background: {
    name: 'Background Art',
    fields: [
      { id: '1', type: 'select', label: 'Background Type', required: true, options: ['Landscape', 'Interior', 'Abstract', 'Fantasy', 'Urban'] },
      { id: '2', type: 'textarea', label: 'Description', required: true },
      { id: '3', type: 'textarea', label: 'Mood & Atmosphere', required: false },
      { id: '4', type: 'file', label: 'Mood Board Images', required: false },
    ],
  },
  commercial: {
    name: 'Commercial Use',
    fields: [
      { id: '1', type: 'select', label: 'Usage Type', required: true, options: ['Print', 'Digital', 'Merchandise', 'Advertising', 'Other'] },
      { id: '2', type: 'text', label: 'Print Size (if applicable)', required: false },
      { id: '3', type: 'textarea', label: 'Commercial Details', required: true },
      { id: '4', type: 'checkbox', label: 'Exclusive Rights', required: false },
    ],
  },
};

export default function FormBuilder({ formFields = [], onSave, onCancel }) {
  const [fields, setFields] = useState(formFields || []);
  const [editingField, setEditingField] = useState(null);
  const [showFieldTypeModal, setShowFieldTypeModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const addField = (type) => {
    const newField = {
      id: Date.now().toString(),
      type,
      label: '',
      required: false,
      placeholder: '',
      options: type === 'select' || type === 'radio' || type === 'multiselect' ? [] : undefined,
      validation: {},
    };
    setFields([...fields, newField]);
    setEditingField(newField);
    setShowFieldTypeModal(false);
  };

  const updateField = (fieldId, updates) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
    if (editingField?.id === fieldId) {
      setEditingField({ ...editingField, ...updates });
    }
  };

  const deleteField = (fieldId) => {
    setFields(fields.filter(f => f.id !== fieldId));
    if (editingField?.id === fieldId) {
      setEditingField(null);
    }
  };

  const applyTemplate = (template) => {
    setFields(template.fields.map(f => ({ ...f, id: Date.now() + Math.random().toString() })));
    setShowTemplateModal(false);
    Toast.show({
      type: 'success',
      text1: 'Template Applied',
      text2: `${template.name} template loaded`,
    });
  };

  const moveField = (fromIndex, toIndex) => {
    const newFields = [...fields];
    const [removed] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, removed);
    setFields(newFields);
  };

  const handleSave = () => {
    // Validate all fields have labels
    const invalidFields = fields.filter(f => !f.label || f.label.trim() === '');
    if (invalidFields.length > 0) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'All fields must have a label',
      });
      return;
    }

    onSave(fields);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Custom Form Builder</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.templateButton}
            onPress={() => setShowTemplateModal(true)}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            <Text style={styles.templateButtonText}>Templates</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowFieldTypeModal(true)}
          >
            <Ionicons name="add" size={24} color={colors.text.primary} />
            <Text style={styles.addButtonText}>Add Field</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.fieldsList} contentContainerStyle={styles.fieldsContent}>
        {fields.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color={colors.text.disabled} />
            <Text style={styles.emptyText}>No fields yet</Text>
            <Text style={styles.emptySubtext}>Add fields or use a template to get started</Text>
          </View>
        ) : (
          fields.map((field, index) => (
            <FieldCard
              key={field.id}
              field={field}
              index={index}
              onEdit={() => setEditingField(field)}
              onDelete={() => deleteField(field.id)}
              onMoveUp={index > 0 ? () => moveField(index, index - 1) : null}
              onMoveDown={index < fields.length - 1 ? () => moveField(index, index + 1) : null}
            />
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Form</Text>
        </TouchableOpacity>
      </View>

      {/* Field Type Selection Modal */}
      <Modal
        visible={showFieldTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFieldTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Field Type</Text>
              <TouchableOpacity onPress={() => setShowFieldTypeModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={FIELD_TYPES}
              numColumns={2}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.fieldTypeCard}
                  onPress={() => addField(item.id)}
                >
                  <Ionicons name={item.icon} size={32} color={colors.primary} />
                  <Text style={styles.fieldTypeLabel}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Template Selection Modal */}
      <Modal
        visible={showTemplateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Template</Text>
              <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {Object.entries(TEMPLATES).map(([key, template]) => (
                <TouchableOpacity
                  key={key}
                  style={styles.templateCard}
                  onPress={() => applyTemplate(template)}
                >
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateFields}>
                    {template.fields.length} fields
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Field Editor Modal */}
      {editingField && (
        <FieldEditor
          field={editingField}
          onUpdate={(updates) => updateField(editingField.id, updates)}
          onClose={() => setEditingField(null)}
        />
      )}
    </View>
  );
}

function FieldCard({ field, index, onEdit, onDelete, onMoveUp, onMoveDown }) {
  const fieldType = FIELD_TYPES.find(ft => ft.id === field.type);
  
  return (
    <View style={styles.fieldCard}>
      <View style={styles.fieldCardHeader}>
        <View style={styles.fieldCardLeft}>
          <Ionicons name={fieldType?.icon || 'help-outline'} size={20} color={colors.primary} />
          <Text style={styles.fieldLabel}>{field.label || 'Unnamed Field'}</Text>
          {field.required && (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>Required</Text>
            </View>
          )}
        </View>
        <View style={styles.fieldCardActions}>
          {onMoveUp && (
            <TouchableOpacity onPress={onMoveUp} style={styles.moveButton}>
              <Ionicons name="chevron-up" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
          {onMoveDown && (
            <TouchableOpacity onPress={onMoveDown} style={styles.moveButton}>
              <Ionicons name="chevron-down" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <Ionicons name="pencil" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={18} color={colors.status.error} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.fieldTypeText}>{fieldType?.label || field.type}</Text>
    </View>
  );
}

function FieldEditor({ field, onUpdate, onClose }) {
  const [localField, setLocalField] = useState(field);
  const [newOption, setNewOption] = useState('');

  const updateLocal = (updates) => {
    const updated = { ...localField, ...updates };
    setLocalField(updated);
    onUpdate(updates);
  };

  const addOption = () => {
    if (newOption.trim()) {
      const options = localField.options || [];
      updateLocal({ options: [...options, newOption.trim()] });
      setNewOption('');
    }
  };

  const removeOption = (index) => {
    const options = localField.options || [];
    updateLocal({ options: options.filter((_, i) => i !== index) });
  };

  return (
    <Modal
      visible={true}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.editorModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Field</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editorContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Field Label *</Text>
              <TextInput
                style={styles.input}
                value={localField.label}
                onChangeText={(text) => updateLocal({ label: text })}
                placeholder="Enter field label"
                placeholderTextColor={colors.text.disabled}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Placeholder Text</Text>
              <TextInput
                style={styles.input}
                value={localField.placeholder || ''}
                onChangeText={(text) => updateLocal({ placeholder: text })}
                placeholder="Enter placeholder text"
                placeholderTextColor={colors.text.disabled}
              />
            </View>

            <View style={styles.switchGroup}>
              <Text style={styles.inputLabel}>Required Field</Text>
              <Switch
                value={localField.required || false}
                onValueChange={(value) => updateLocal({ required: value })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.text.primary}
              />
            </View>

            {(localField.type === 'select' || localField.type === 'radio' || localField.type === 'multiselect') && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Options</Text>
                {localField.options?.map((option, index) => (
                  <View key={index} style={styles.optionRow}>
                    <Text style={styles.optionText}>{option}</Text>
                    <TouchableOpacity onPress={() => removeOption(index)}>
                      <Ionicons name="close-circle" size={20} color={colors.status.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.addOptionRow}>
                  <TextInput
                    style={[styles.input, styles.optionInput]}
                    value={newOption}
                    onChangeText={setNewOption}
                    placeholder="Add option"
                    placeholderTextColor={colors.text.disabled}
                    onSubmitEditing={addOption}
                  />
                  <TouchableOpacity style={styles.addOptionButton} onPress={addOption}>
                    <Ionicons name="add" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {localField.type === 'number' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Min Value</Text>
                <TextInput
                  style={styles.input}
                  value={localField.validation?.min?.toString() || ''}
                  onChangeText={(text) => updateLocal({
                    validation: { ...localField.validation, min: text ? parseFloat(text) : undefined }
                  })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.disabled}
                />
                <Text style={styles.inputLabel}>Max Value</Text>
                <TextInput
                  style={styles.input}
                  value={localField.validation?.max?.toString() || ''}
                  onChangeText={(text) => updateLocal({
                    validation: { ...localField.validation, max: text ? parseFloat(text) : undefined }
                  })}
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
            )}
          </ScrollView>

          <View style={styles.editorFooter}>
            <TouchableOpacity style={styles.doneButton} onPress={onClose}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  templateButton: {
    ...components.buttonSmall,
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  templateButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'transparent',
  },
  addButtonText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  fieldsList: {
    flex: 1,
  },
  fieldsContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.text.disabled,
    marginTop: spacing.lg,
  },
  fieldCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  fieldCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  fieldLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    flex: 1,
  },
  requiredBadge: {
    backgroundColor: colors.status.error + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  requiredText: {
    ...typography.small,
    color: colors.status.error,
    fontSize: 10,
  },
  fieldCardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  moveButton: {
    padding: spacing.xs,
  },
  editButton: {
    padding: spacing.xs,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  fieldTypeText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
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
  saveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  fieldTypeCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    margin: spacing.xs,
    minHeight: 100,
    justifyContent: 'center',
  },
  fieldTypeLabel: {
    ...typography.body,
    color: colors.text.primary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  templateCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  templateName: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  templateFields: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  editorModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    flex: 1,
  },
  editorContent: {
    flex: 1,
    padding: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
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
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  optionText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  addOptionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  optionInput: {
    flex: 1,
  },
  addOptionButton: {
    padding: spacing.md,
    justifyContent: 'center',
  },
  editorFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  doneButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
});
