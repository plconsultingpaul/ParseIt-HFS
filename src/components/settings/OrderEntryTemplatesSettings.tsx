import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit2, Copy, GripVertical, ChevronDown, ChevronRight, Check, Loader2, AlertCircle, FileText, ChevronsDown, ChevronsRight, Eye, Braces } from 'lucide-react';
import type { OrderEntryTemplate, OrderEntryFieldGroup, OrderEntryField, OrderEntryFieldLayout, ExtractionType, FieldMapping, DropdownOption } from '../../types';
import { supabase } from '../../lib/supabase';
import Select from '../common/Select';
import FieldTypeIcon, { FieldTypeBadge } from '../common/FieldTypeIcon';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../common/ToastContainer';
import { FormSkeleton } from '../common/Skeleton';
import LayoutDesigner from './LayoutDesigner';
import FormPreviewModal from './FormPreviewModal';

interface OrderEntryTemplatesSettingsProps {
  extractionTypes: ExtractionType[];
}

type OrderEntryFieldType = 'text' | 'number' | 'date' | 'datetime' | 'phone' | 'dropdown' | 'file' | 'boolean' | 'zip' | 'postal_code' | 'zip_postal' | 'province' | 'state';

export default function OrderEntryTemplatesSettings({ extractionTypes }: OrderEntryTemplatesSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<OrderEntryTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [fieldGroups, setFieldGroups] = useState<OrderEntryFieldGroup[]>([]);
  const [fields, setFields] = useState<OrderEntryField[]>([]);
  const [fieldLayouts, setFieldLayouts] = useState<OrderEntryFieldLayout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState({
    fieldGroups: true,
    formLayout: true
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showCopyFromGlobalModal, setShowCopyFromGlobalModal] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState<Partial<OrderEntryTemplate> | null>(null);
  const [editingGroup, setEditingGroup] = useState<Partial<OrderEntryFieldGroup> | null>(null);
  const [editingField, setEditingField] = useState<Partial<OrderEntryField> | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<OrderEntryTemplate | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [layoutSaveStatus, setLayoutSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const layoutSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplateData(selectedTemplateId);
    } else {
      setFieldGroups([]);
      setFields([]);
      setFieldLayouts([]);
    }
  }, [selectedTemplateId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('order_entry_templates')
        .select('*')
        .order('name');

      if (error) throw error;

      const templatesData: OrderEntryTemplate[] = (data || []).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        extractionTypeId: t.extraction_type_id,
        isActive: t.is_active,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }));

      setTemplates(templatesData);

      if (templatesData.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(templatesData[0].id);
      }
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateData = async (templateId: string) => {
    try {
      const [groupsRes, fieldsRes, layoutsRes] = await Promise.all([
        supabase
          .from('order_entry_template_field_groups')
          .select('*')
          .eq('template_id', templateId)
          .order('group_order', { ascending: true }),
        supabase
          .from('order_entry_template_fields')
          .select('*')
          .eq('template_id', templateId)
          .order('field_order', { ascending: true }),
        supabase
          .from('order_entry_template_field_layout')
          .select('*')
          .eq('template_id', templateId)
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (fieldsRes.error) throw fieldsRes.error;
      if (layoutsRes.error) throw layoutsRes.error;

      const groups = (groupsRes.data || []).map((g: any) => ({
        id: g.id,
        templateId: g.template_id,
        groupName: g.group_name,
        groupOrder: g.group_order,
        description: g.description,
        isCollapsible: g.is_collapsible,
        isExpandedByDefault: g.is_expanded_by_default,
        backgroundColor: g.background_color,
        borderColor: g.border_color,
        isArrayGroup: g.is_array_group || false,
        arrayMinRows: g.array_min_rows || 1,
        arrayMaxRows: g.array_max_rows || 10,
        arrayJsonPath: g.array_json_path || '',
        hideAddRow: g.hide_add_row || false,
        createdAt: g.created_at,
        updatedAt: g.updated_at
      }));

      const fieldsData = (fieldsRes.data || []).map((f: any) => ({
        id: f.id,
        templateId: f.template_id,
        fieldGroupId: f.field_group_id,
        fieldName: f.field_name,
        fieldLabel: f.field_label,
        fieldType: f.field_type,
        placeholder: f.placeholder,
        helpText: f.help_text,
        isRequired: f.is_required,
        maxLength: f.max_length,
        minValue: f.min_value,
        maxValue: f.max_value,
        defaultValue: f.default_value,
        dropdownOptions: f.dropdown_options || [],
        dropdownDisplayMode: f.dropdown_display_mode || 'description_only',
        jsonPath: f.json_path,
        isArrayField: f.is_array_field,
        arrayMinRows: f.array_min_rows,
        arrayMaxRows: f.array_max_rows,
        aiExtractionInstructions: f.ai_extraction_instructions,
        validationRegex: f.validation_regex,
        validationErrorMessage: f.validation_error_message,
        fieldOrder: f.field_order,
        copyFromField: f.copy_from_field,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      }));

      const layouts = (layoutsRes.data || []).map((l: any) => ({
        id: l.id,
        templateId: l.template_id,
        fieldId: l.field_id,
        rowIndex: l.row_index,
        columnIndex: l.column_index,
        widthColumns: l.width_columns,
        mobileWidthColumns: l.mobile_width_columns,
        createdAt: l.created_at,
        updatedAt: l.updated_at
      }));

      const previousGroupIds = new Set(fieldGroups.map(g => g.id));

      setFieldGroups(groups);
      setFields(fieldsData);
      setFieldLayouts(layouts);

      setCollapsedGroups(prev => {
        if (prev.size === 0 && previousGroupIds.size === 0) {
          return new Set(groups.map((g: OrderEntryFieldGroup) => g.id));
        }
        const currentGroupIds = new Set(groups.map((g: OrderEntryFieldGroup) => g.id));
        const preserved = new Set<string>();
        prev.forEach(id => {
          if (currentGroupIds.has(id)) {
            preserved.add(id);
          }
        });
        groups.forEach((g: OrderEntryFieldGroup) => {
          if (!previousGroupIds.has(g.id)) {
            preserved.add(g.id);
          }
        });
        return preserved;
      });
    } catch (err: any) {
      setError(err.message);
      toast.error('Failed to load template data');
    }
  };

  const handleCreateTemplate = async () => {
    if (!editingTemplate?.name?.trim()) {
      toast.error('Template name is required');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('order_entry_templates')
        .insert([{
          name: editingTemplate.name.trim(),
          description: editingTemplate.description?.trim() || null,
          extraction_type_id: editingTemplate.extractionTypeId || null,
          is_active: editingTemplate.isActive ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Template created successfully');
      setShowCreateModal(false);
      setEditingTemplate(null);
      await loadTemplates();
      setSelectedTemplateId(data.id);
    } catch (err: any) {
      toast.error('Failed to create template: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate?.id || !editingTemplate?.name?.trim()) {
      toast.error('Template name is required');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('order_entry_templates')
        .update({
          name: editingTemplate.name.trim(),
          description: editingTemplate.description?.trim() || null,
          extraction_type_id: editingTemplate.extractionTypeId || null,
          is_active: editingTemplate.isActive ?? true,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      toast.success('Template updated successfully');
      setShowEditModal(false);
      setEditingTemplate(null);
      await loadTemplates();
    } catch (err: any) {
      toast.error('Failed to update template: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('order_entry_templates')
        .delete()
        .eq('id', templateToDelete.id);

      if (error) throw error;

      toast.success('Template deleted successfully');
      setShowDeleteModal(false);
      setTemplateToDelete(null);

      if (selectedTemplateId === templateToDelete.id) {
        setSelectedTemplateId(null);
      }

      await loadTemplates();
    } catch (err: any) {
      toast.error('Failed to delete template: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyFromGlobal = async () => {
    if (!editingTemplate?.name?.trim()) {
      toast.error('Template name is required');
      return;
    }

    setIsSaving(true);
    try {
      const { data: templateData, error: templateError } = await supabase
        .from('order_entry_templates')
        .insert([{
          name: editingTemplate.name.trim(),
          description: editingTemplate.description?.trim() || 'Copied from global configuration',
          extraction_type_id: editingTemplate.extractionTypeId || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (templateError) throw templateError;

      const [globalGroupsRes, globalFieldsRes, globalLayoutsRes] = await Promise.all([
        supabase.from('order_entry_field_groups').select('*').order('group_order'),
        supabase.from('order_entry_fields').select('*').order('field_order'),
        supabase.from('order_entry_field_layout').select('*')
      ]);

      if (globalGroupsRes.error) throw globalGroupsRes.error;
      if (globalFieldsRes.error) throw globalFieldsRes.error;
      if (globalLayoutsRes.error) throw globalLayoutsRes.error;

      const groupIdMap: Record<string, string> = {};
      const fieldIdMap: Record<string, string> = {};

      if (globalGroupsRes.data && globalGroupsRes.data.length > 0) {
        for (const group of globalGroupsRes.data) {
          const { data: newGroup, error: groupError } = await supabase
            .from('order_entry_template_field_groups')
            .insert([{
              template_id: templateData.id,
              group_name: group.group_name,
              group_order: group.group_order,
              description: group.description,
              is_collapsible: group.is_collapsible,
              is_expanded_by_default: group.is_expanded_by_default,
              background_color: group.background_color,
              border_color: group.border_color,
              is_array_group: group.is_array_group,
              array_min_rows: group.array_min_rows,
              array_max_rows: group.array_max_rows,
              array_json_path: group.array_json_path,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (groupError) throw groupError;
          groupIdMap[group.id] = newGroup.id;
        }
      }

      if (globalFieldsRes.data && globalFieldsRes.data.length > 0) {
        for (const field of globalFieldsRes.data) {
          const newGroupId = groupIdMap[field.field_group_id];
          if (!newGroupId) continue;

          const { data: newField, error: fieldError } = await supabase
            .from('order_entry_template_fields')
            .insert([{
              template_id: templateData.id,
              field_group_id: newGroupId,
              field_name: field.field_name,
              field_label: field.field_label,
              field_type: field.field_type,
              placeholder: field.placeholder,
              help_text: field.help_text,
              is_required: field.is_required,
              max_length: field.max_length,
              min_value: field.min_value,
              max_value: field.max_value,
              default_value: field.default_value,
              dropdown_options: field.dropdown_options,
              json_path: field.json_path,
              is_array_field: field.is_array_field,
              array_min_rows: field.array_min_rows,
              array_max_rows: field.array_max_rows,
              ai_extraction_instructions: field.ai_extraction_instructions,
              validation_regex: field.validation_regex,
              validation_error_message: field.validation_error_message,
              field_order: field.field_order,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (fieldError) throw fieldError;
          fieldIdMap[field.id] = newField.id;
        }
      }

      if (globalLayoutsRes.data && globalLayoutsRes.data.length > 0) {
        const layoutsToInsert = globalLayoutsRes.data
          .filter(layout => fieldIdMap[layout.field_id])
          .map(layout => ({
            template_id: templateData.id,
            field_id: fieldIdMap[layout.field_id],
            row_index: layout.row_index,
            column_index: layout.column_index,
            width_columns: layout.width_columns,
            mobile_width_columns: layout.mobile_width_columns,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

        if (layoutsToInsert.length > 0) {
          const { error: layoutError } = await supabase
            .from('order_entry_template_field_layout')
            .insert(layoutsToInsert);

          if (layoutError) throw layoutError;
        }
      }

      toast.success('Template created from global configuration');
      setShowCopyFromGlobalModal(false);
      setEditingTemplate(null);
      await loadTemplates();
      setSelectedTemplateId(templateData.id);
    } catch (err: any) {
      toast.error('Failed to copy from global: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!editingGroup?.groupName?.trim() || !selectedTemplateId) {
      toast.error('Group name is required');
      return;
    }

    setIsSaving(true);
    try {
      const groupData = {
        template_id: selectedTemplateId,
        group_name: editingGroup.groupName.trim(),
        group_order: editingGroup.groupOrder || fieldGroups.length,
        description: editingGroup.description || null,
        is_collapsible: editingGroup.isCollapsible || false,
        is_expanded_by_default: editingGroup.isExpandedByDefault ?? true,
        background_color: editingGroup.backgroundColor || '#ffffff',
        border_color: editingGroup.borderColor || '#14b8a6',
        is_array_group: editingGroup.isArrayGroup || false,
        array_min_rows: editingGroup.arrayMinRows || 1,
        array_max_rows: editingGroup.arrayMaxRows || 10,
        array_json_path: editingGroup.arrayJsonPath || null,
        hide_add_row: editingGroup.hideAddRow || false,
        updated_at: new Date().toISOString()
      };

      if (editingGroup.id) {
        const { error } = await supabase
          .from('order_entry_template_field_groups')
          .update(groupData)
          .eq('id', editingGroup.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('order_entry_template_field_groups')
          .insert([{ ...groupData, created_at: new Date().toISOString() }]);
        if (error) throw error;
      }

      toast.success(editingGroup.id ? 'Group updated' : 'Group created');
      setShowGroupModal(false);
      setEditingGroup(null);
      await loadTemplateData(selectedTemplateId);
    } catch (err: any) {
      toast.error('Failed to save group: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this group and all its fields?')) return;

    try {
      const { error } = await supabase
        .from('order_entry_template_field_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Group deleted');
      if (selectedTemplateId) {
        await loadTemplateData(selectedTemplateId);
      }
    } catch (err: any) {
      toast.error('Failed to delete group: ' + err.message);
    }
  };

  const handleSaveField = async () => {
    if (!editingField?.fieldName?.trim() || !editingField?.fieldLabel?.trim() || !selectedTemplateId) {
      toast.error('Field name and label are required');
      return;
    }

    setIsSaving(true);
    try {
      const cleanedDropdownOptions = (editingField.dropdownOptions || [])
        .filter((opt: string | DropdownOption) => {
          if (typeof opt === 'string') return opt.trim().length > 0;
          return opt.value?.trim().length > 0;
        })
        .map((opt: string | DropdownOption) => {
          if (typeof opt === 'string') return { value: opt.trim(), description: opt.trim() };
          return { value: opt.value?.trim() || '', description: opt.description?.trim() || opt.value?.trim() || '' };
        });

      const fieldData = {
        template_id: selectedTemplateId,
        field_group_id: editingField.fieldGroupId,
        field_name: editingField.fieldName.trim(),
        field_label: editingField.fieldLabel.trim(),
        field_type: editingField.fieldType || 'text',
        placeholder: editingField.placeholder || null,
        help_text: editingField.helpText || null,
        is_required: editingField.isRequired || false,
        max_length: editingField.maxLength || null,
        min_value: editingField.minValue || null,
        max_value: editingField.maxValue || null,
        default_value: editingField.defaultValue || null,
        dropdown_options: cleanedDropdownOptions,
        dropdown_display_mode: editingField.dropdownDisplayMode || 'description_only',
        json_path: editingField.jsonPath || null,
        is_array_field: editingField.isArrayField || false,
        array_min_rows: editingField.arrayMinRows || 1,
        array_max_rows: editingField.arrayMaxRows || 10,
        ai_extraction_instructions: editingField.aiExtractionInstructions || null,
        validation_regex: editingField.validationRegex || null,
        validation_error_message: editingField.validationErrorMessage || null,
        field_order: editingField.fieldOrder || fields.filter(f => f.fieldGroupId === editingField.fieldGroupId).length,
        copy_from_field: editingField.copyFromField || null,
        updated_at: new Date().toISOString()
      };

      if (editingField.id) {
        const { error } = await supabase
          .from('order_entry_template_fields')
          .update(fieldData)
          .eq('id', editingField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('order_entry_template_fields')
          .insert([{ ...fieldData, created_at: new Date().toISOString() }]);
        if (error) throw error;
      }

      toast.success(editingField.id ? 'Field updated' : 'Field created');
      setShowFieldModal(false);
      setEditingField(null);
      await loadTemplateData(selectedTemplateId);
    } catch (err: any) {
      toast.error('Failed to save field: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Delete this field?')) return;

    try {
      const { error } = await supabase
        .from('order_entry_template_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;

      toast.success('Field deleted');
      if (selectedTemplateId) {
        await loadTemplateData(selectedTemplateId);
      }
    } catch (err: any) {
      toast.error('Failed to delete field: ' + err.message);
    }
  };

  const saveLayoutToDatabase = async (layouts: OrderEntryFieldLayout[], templateId: string) => {
    try {
      setLayoutSaveStatus('saving');

      const layoutsToUpsert = layouts.map(layout => ({
        template_id: templateId,
        field_id: layout.fieldId,
        row_index: layout.rowIndex,
        column_index: layout.columnIndex,
        width_columns: layout.widthColumns,
        mobile_width_columns: layout.mobileWidthColumns,
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('order_entry_template_field_layout')
        .upsert(layoutsToUpsert, {
          onConflict: 'template_id,field_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      const updatedLayouts: OrderEntryFieldLayout[] = (data || []).map(d => ({
        id: d.id,
        templateId: d.template_id,
        fieldId: d.field_id,
        rowIndex: d.row_index,
        columnIndex: d.column_index,
        widthColumns: d.width_columns,
        mobileWidthColumns: d.mobile_width_columns,
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }));

      const deletedFieldIds = fieldLayouts
        .map(l => l.fieldId)
        .filter(id => !layouts.find(l => l.fieldId === id));

      if (deletedFieldIds.length > 0) {
        await supabase
          .from('order_entry_template_field_layout')
          .delete()
          .eq('template_id', templateId)
          .in('field_id', deletedFieldIds);
      }

      setFieldLayouts(updatedLayouts);
      setLayoutSaveStatus('saved');

      setTimeout(() => {
        setLayoutSaveStatus('idle');
      }, 2000);
    } catch (err: any) {
      setLayoutSaveStatus('error');
      toast.error('Failed to save layout: ' + err.message);
    }
  };

  const handleLayoutChange = useCallback((layouts: OrderEntryFieldLayout[]) => {
    if (!selectedTemplateId) return;

    setFieldLayouts(layouts);
    setLayoutSaveStatus('saving');

    if (layoutSaveTimeoutRef.current) {
      clearTimeout(layoutSaveTimeoutRef.current);
    }

    layoutSaveTimeoutRef.current = setTimeout(() => {
      saveLayoutToDatabase(layouts, selectedTemplateId);
    }, 800);
  }, [selectedTemplateId, fieldLayouts]);

  const handleGroupOrderChange = useCallback(async (updatedGroups: OrderEntryFieldGroup[]) => {
    if (!selectedTemplateId) return;

    setFieldGroups(updatedGroups);
    setLayoutSaveStatus('saving');

    try {
      for (const group of updatedGroups) {
        const { error } = await supabase
          .from('order_entry_template_field_groups')
          .update({ group_order: group.groupOrder })
          .eq('id', group.id);

        if (error) throw error;
      }
      setLayoutSaveStatus('saved');
      setTimeout(() => setLayoutSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving group order:', error);
      setLayoutSaveStatus('error');
      toast.error('Failed to save group order');
    }
  }, [selectedTemplateId]);

  const toggleGroupCollapse = (groupId: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupId)) {
      newCollapsed.delete(groupId);
    } else {
      newCollapsed.add(groupId);
    }
    setCollapsedGroups(newCollapsed);
  };

  const collapseAllGroups = () => {
    setCollapsedGroups(new Set(fieldGroups.map(g => g.id)));
  };

  const expandAllGroups = () => {
    setCollapsedGroups(new Set());
  };

  const toggleSectionCollapse = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handlePreviewForm = async () => {
    if (fields.length === 0 || !selectedTemplateId) return;

    setLoadingPreview(true);

    if (layoutSaveTimeoutRef.current) {
      clearTimeout(layoutSaveTimeoutRef.current);
      await saveLayoutToDatabase(fieldLayouts, selectedTemplateId);
    }

    await loadTemplateData(selectedTemplateId);

    setTimeout(() => {
      setShowPreviewModal(true);
      setLoadingPreview(false);
    }, 100);
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  if (loading) {
    return <FormSkeleton fields={6} />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Order Entry Templates</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create and manage templates to assign different forms to clients
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setEditingTemplate({ name: '', description: '', isActive: true });
                setShowCopyFromGlobalModal(true);
              }}
              className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy From Global
            </button>
            {selectedTemplateId && fields.length > 0 && (
              <button
                onClick={handlePreviewForm}
                disabled={loadingPreview}
                className="flex items-center px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                title="Preview form configuration"
              >
                <Eye className={`h-4 w-4 mr-2 ${loadingPreview ? 'animate-pulse' : ''}`} />
                Preview
              </button>
            )}
            <button
              onClick={() => {
                setEditingTemplate({ name: '', description: '', isActive: true });
                setShowCreateModal(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </button>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No templates yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Create a template or copy from global configuration
            </p>
          </div>
        ) : (
          <div className="flex items-center space-x-4 mb-6">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Select Template:
            </label>
            <div className="flex-1 max-w-md">
              <Select
                value={selectedTemplateId || ''}
                onValueChange={setSelectedTemplateId}
                options={templates.map(t => ({
                  value: t.id,
                  label: `${t.name}${t.isActive ? '' : ' (Inactive)'}`
                }))}
                searchable
              />
            </div>
            {selectedTemplate && (
              <>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setEditingTemplate(selectedTemplate);
                      setShowEditModal(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Edit template"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setTemplateToDelete(selectedTemplate);
                      setShowDeleteModal(true);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="ml-4 pl-4 border-l border-gray-300 dark:border-gray-600">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Extraction Type:</span>
                  <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedTemplate.extractionTypeId
                      ? extractionTypes.find(et => et.id === selectedTemplate.extractionTypeId)?.name || 'Unknown'
                      : 'None'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {selectedTemplate && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <button
            onClick={() => toggleSectionCollapse('fieldGroups')}
            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-4"
          >
            <div className="flex items-center space-x-3">
              {collapsedSections.fieldGroups ? (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
              <div className="text-left">
                <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100">
                  Field Groups - {selectedTemplate.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedTemplate.description || 'Configure fields for this template'}
                </p>
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full">
              {fieldGroups.length} {fieldGroups.length === 1 ? 'group' : 'groups'}
            </span>
          </button>

          {!collapsedSections.fieldGroups && (
            <div className="flex items-center justify-end space-x-2 mb-4">
              <button
                onClick={collapseAllGroups}
                className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ChevronsRight className="h-4 w-4 mr-2" />
                Collapse All
              </button>
              <button
                onClick={expandAllGroups}
                className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ChevronsDown className="h-4 w-4 mr-2" />
                Expand All
              </button>
              <button
                onClick={() => {
                  setEditingGroup({
                    groupName: '',
                    groupOrder: fieldGroups.length,
                    isCollapsible: false,
                    isExpandedByDefault: true,
                    backgroundColor: '#ffffff',
                    borderColor: '#14b8a6',
                    isArrayGroup: false,
                    arrayMinRows: 1,
                    arrayMaxRows: 10
                  });
                  setShowGroupModal(true);
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Group
              </button>
            </div>
          )}

          {!collapsedSections.fieldGroups && (
          <div className="space-y-4">
            {fieldGroups.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <p className="text-gray-600 dark:text-gray-400">No field groups yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Add a group to start building the form
                </p>
              </div>
            ) : (
              fieldGroups.map(group => {
                const isCollapsed = collapsedGroups.has(group.id);
                const groupFields = fields.filter(f => f.fieldGroupId === group.id);

                return (
                  <div
                    key={group.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    style={{ borderColor: group.borderColor }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-3 flex-1">
                        <GripVertical className="h-5 w-5 text-gray-400 mt-1 cursor-move" />
                        <button
                          onClick={() => toggleGroupCollapse(group.id)}
                          className="flex items-center space-x-2 text-left hover:opacity-70 transition-opacity"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-5 w-5 text-gray-500 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900 dark:text-gray-100">{group.groupName}</h4>
                              <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                                {groupFields.length} {groupFields.length === 1 ? 'field' : 'fields'}
                              </span>
                              {group.isArrayGroup && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                                  Array Group
                                </span>
                              )}
                            </div>
                            {group.description && !isCollapsed && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{group.description}</p>
                            )}
                          </div>
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingField({
                              fieldGroupId: group.id,
                              fieldName: '',
                              fieldLabel: '',
                              fieldType: 'text',
                              isRequired: false,
                              dropdownOptions: [],
                              isArrayField: false,
                              arrayMinRows: 1,
                              arrayMaxRows: 10,
                              fieldOrder: groupFields.length
                            });
                            setShowFieldModal(true);
                          }}
                          className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                          title="Add Field"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingGroup(group);
                            setShowGroupModal(true);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Edit Group"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete Group"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="space-y-2 ml-8">
                        {groupFields.map(field => (
                          <div
                            key={field.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                              <FieldTypeIcon fieldType={field.fieldType} size="sm" />
                              <div>
                                <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                    {field.fieldLabel}
                                  </span>
                                  <FieldTypeBadge fieldType={field.fieldType} />
                                  {field.isRequired && (
                                    <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                                      Required
                                    </span>
                                  )}
                                  {field.jsonPath && (
                                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded font-mono">
                                      {field.jsonPath}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  setEditingField(field);
                                  setShowFieldModal(true);
                                }}
                                className="p-1 text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                title="Edit Field"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteField(field.id)}
                                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                title="Delete Field"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {groupFields.length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No fields in this group</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          )}
        </div>
      )}

      {selectedTemplate && fields.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <button
            onClick={() => toggleSectionCollapse('formLayout')}
            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center space-x-3">
              {collapsedSections.formLayout ? (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Form Layout</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Changes are automatically saved
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {layoutSaveStatus === 'saving' && (
                <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              )}
              {layoutSaveStatus === 'saved' && (
                <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  <span>Saved</span>
                </div>
              )}
              {layoutSaveStatus === 'error' && (
                <div className="flex items-center space-x-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>Error saving</span>
                </div>
              )}
            </div>
          </button>
          {!collapsedSections.formLayout && (
            <div className="mt-4">
              <LayoutDesigner
                fields={fields}
                fieldGroups={fieldGroups}
                layouts={fieldLayouts}
                onLayoutChange={handleLayoutChange}
                onGroupOrderChange={handleGroupOrderChange}
              />
            </div>
          )}
        </div>
      )}

      {showCreateModal && createPortal(
        <TemplateModal
          title="Create New Template"
          template={editingTemplate}
          onChange={setEditingTemplate}
          onSave={handleCreateTemplate}
          onClose={() => { setShowCreateModal(false); setEditingTemplate(null); }}
          isSaving={isSaving}
          extractionTypes={extractionTypes}
        />,
        document.body
      )}

      {showEditModal && createPortal(
        <TemplateModal
          title="Edit Template"
          template={editingTemplate}
          onChange={setEditingTemplate}
          onSave={handleUpdateTemplate}
          onClose={() => { setShowEditModal(false); setEditingTemplate(null); }}
          isSaving={isSaving}
          extractionTypes={extractionTypes}
        />,
        document.body
      )}

      {showDeleteModal && templateToDelete && createPortal(
        <DeleteConfirmModal
          templateName={templateToDelete.name}
          onConfirm={handleDeleteTemplate}
          onClose={() => { setShowDeleteModal(false); setTemplateToDelete(null); }}
          isSaving={isSaving}
        />,
        document.body
      )}

      {showCopyFromGlobalModal && createPortal(
        <TemplateModal
          title="Copy From Global Configuration"
          template={editingTemplate}
          onChange={setEditingTemplate}
          onSave={handleCopyFromGlobal}
          onClose={() => { setShowCopyFromGlobalModal(false); setEditingTemplate(null); }}
          isSaving={isSaving}
          extractionTypes={extractionTypes}
          saveButtonText="Create and Copy"
        />,
        document.body
      )}

      {showGroupModal && createPortal(
        <GroupModal
          group={editingGroup}
          onChange={setEditingGroup}
          onSave={handleSaveGroup}
          onClose={() => { setShowGroupModal(false); setEditingGroup(null); }}
          isSaving={isSaving}
        />,
        document.body
      )}

      {showFieldModal && createPortal(
        <FieldModal
          field={editingField}
          onChange={setEditingField}
          onSave={handleSaveField}
          onClose={() => { setShowFieldModal(false); setEditingField(null); }}
          isSaving={isSaving}
          extractionTypeFieldMappings={
            selectedTemplate?.extractionTypeId
              ? extractionTypes.find(et => et.id === selectedTemplate.extractionTypeId)?.fieldMappings || []
              : []
          }
          allFields={fields}
        />,
        document.body
      )}

      <FormPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        fields={fields}
        fieldGroups={fieldGroups}
        layouts={fieldLayouts}
      />

      <ToastContainer toasts={toast.toasts} onClose={toast.closeToast} />
    </div>
  );
}

interface TemplateModalProps {
  title: string;
  template: Partial<OrderEntryTemplate> | null;
  onChange: (template: Partial<OrderEntryTemplate> | null) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  extractionTypes: ExtractionType[];
  saveButtonText?: string;
}

function TemplateModal({ title, template, onChange, onSave, onClose, isSaving, extractionTypes, saveButtonText = 'Save' }: TemplateModalProps) {
  if (!template) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={template.name || ''}
              onChange={(e) => onChange({ ...template, name: e.target.value })}
              placeholder="e.g., Standard Order Form"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={template.description || ''}
              onChange={(e) => onChange({ ...template, description: e.target.value })}
              placeholder="Optional description"
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Extraction Type (for processing)
            </label>
            <Select
              value={template.extractionTypeId || '__none__'}
              onValueChange={(value) => onChange({ ...template, extractionTypeId: value === '__none__' ? undefined : value })}
              options={[
                { value: '__none__', label: 'No extraction type' },
                ...extractionTypes.map(et => ({ value: et.id, label: et.name }))
              ]}
              searchable
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Links to an Extraction Type for JSON Template, Field Mappings, and Workflow processing
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="templateActive"
              checked={template.isActive ?? true}
              onChange={(e) => onChange({ ...template, isActive: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="templateActive" className="text-sm text-gray-700 dark:text-gray-300">
              Active (available for assignment)
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !template.name?.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saveButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  templateName: string;
  onConfirm: () => void;
  onClose: () => void;
  isSaving: boolean;
}

function DeleteConfirmModal({ templateName, onConfirm, onClose, isSaving }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-red-600 dark:text-red-400">Delete Template</h3>
        </div>

        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete <strong>"{templateName}"</strong>?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            This will delete all field groups, fields, and layouts in this template. This action cannot be undone.
          </p>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface GroupModalProps {
  group: Partial<OrderEntryFieldGroup> | null;
  onChange: (group: Partial<OrderEntryFieldGroup> | null) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
}

function GroupModal({ group, onChange, onSave, onClose, isSaving }: GroupModalProps) {
  if (!group) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {group.id ? 'Edit Field Group' : 'Create Field Group'}
          </h3>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Group Name *
            </label>
            <input
              type="text"
              value={group.groupName || ''}
              onChange={(e) => onChange({ ...group, groupName: e.target.value })}
              placeholder="e.g., Shipment Details"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={group.description || ''}
              onChange={(e) => onChange({ ...group, description: e.target.value })}
              placeholder="Optional description"
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Background Color
              </label>
              <input
                type="color"
                value={group.backgroundColor || '#ffffff'}
                onChange={(e) => onChange({ ...group, backgroundColor: e.target.value })}
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Border Color
              </label>
              <input
                type="color"
                value={group.borderColor || '#14b8a6'}
                onChange={(e) => onChange({ ...group, borderColor: e.target.value })}
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={group.isCollapsible || false}
                onChange={(e) => onChange({ ...group, isCollapsible: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Collapsible</span>
            </label>
            {group.isCollapsible && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={group.isExpandedByDefault ?? true}
                  onChange={(e) => onChange({ ...group, isExpandedByDefault: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Expanded by Default</span>
              </label>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <label className="flex items-center mb-4">
              <input
                type="checkbox"
                checked={group.isArrayGroup || false}
                onChange={(e) => onChange({ ...group, isArrayGroup: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Make this an Array Group</span>
            </label>

            {group.isArrayGroup && (
              <div className="space-y-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Min Rows
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={group.arrayMinRows || 1}
                      onChange={(e) => onChange({ ...group, arrayMinRows: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Rows
                    </label>
                    <input
                      type="number"
                      min={group.arrayMinRows || 1}
                      value={group.arrayMaxRows || 10}
                      onChange={(e) => onChange({ ...group, arrayMaxRows: parseInt(e.target.value) || 10 })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Array JSON Path
                  </label>
                  <input
                    type="text"
                    value={group.arrayJsonPath || ''}
                    onChange={(e) => onChange({ ...group, arrayJsonPath: e.target.value })}
                    placeholder="e.g., orders[details][]"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <label className="flex items-center mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                  <input
                    type="checkbox"
                    checked={group.hideAddRow || false}
                    onChange={(e) => onChange({ ...group, hideAddRow: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Hide Add Row Button</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Fixed rows only - users cannot add or remove rows</p>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !group.groupName?.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Group
          </button>
        </div>
      </div>
    </div>
  );
}

interface FieldModalProps {
  field: Partial<OrderEntryField> | null;
  onChange: (field: Partial<OrderEntryField> | null) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  extractionTypeFieldMappings?: FieldMapping[];
  allFields: OrderEntryField[];
}

function FieldModal({ field, onChange, onSave, onClose, isSaving, extractionTypeFieldMappings = [], allFields }: FieldModalProps) {
  const [showFieldMappingDropdown, setShowFieldMappingDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const orderEntryFieldMappings = extractionTypeFieldMappings.filter(m => m.type === 'order_entry');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFieldMappingDropdown(false);
      }
    };

    if (showFieldMappingDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFieldMappingDropdown]);

  if (!field) return null;

  const fieldTypes: { value: OrderEntryFieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'Date & Time' },
    { value: 'phone', label: 'Phone' },
    { value: 'zip', label: 'Zip Code (US)' },
    { value: 'postal_code', label: 'Postal Code (CA)' },
    { value: 'zip_postal', label: 'Zip/Postal Code (US or CA)' },
    { value: 'province', label: 'Province' },
    { value: 'state', label: 'State' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'file', label: 'File Upload' },
    { value: 'boolean', label: 'Checkbox' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {field.id ? 'Edit Field' : 'Create Field'}
          </h3>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Field Name (Internal) *
              </label>
              <input
                type="text"
                value={field.fieldName || ''}
                onChange={(e) => onChange({ ...field, fieldName: e.target.value })}
                placeholder="e.g., shipper_name"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Field Label (Display) *
              </label>
              <input
                type="text"
                value={field.fieldLabel || ''}
                onChange={(e) => onChange({ ...field, fieldLabel: e.target.value })}
                placeholder="e.g., Shipper Name"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Field Type *
              </label>
              <Select
                value={field.fieldType || 'text'}
                onValueChange={(value) => onChange({ ...field, fieldType: value as OrderEntryFieldType })}
                options={fieldTypes.map(type => ({ value: type.value, label: type.label }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                JSON Path for API
              </label>
              <div className="relative" ref={dropdownRef}>
                <div className="flex">
                  <input
                    type="text"
                    value={field.jsonPath || ''}
                    onChange={(e) => onChange({ ...field, jsonPath: e.target.value })}
                    placeholder="e.g., order.shipper.name"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFieldMappingDropdown(!showFieldMappingDropdown)}
                    disabled={orderEntryFieldMappings.length === 0}
                    className={`px-3 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg transition-colors ${
                      orderEntryFieldMappings.length === 0
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'
                    }`}
                    title={orderEntryFieldMappings.length === 0 ? 'No Order Entry type field mappings available' : 'Select from Order Entry field mappings'}
                  >
                    <Braces className="h-4 w-4" />
                  </button>
                </div>
                {showFieldMappingDropdown && orderEntryFieldMappings.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {orderEntryFieldMappings.map((mapping, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          onChange({ ...field, jsonPath: mapping.fieldName });
                          setShowFieldMappingDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-between"
                      >
                        <span className="font-mono text-gray-900 dark:text-gray-100">{mapping.fieldName}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{mapping.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {orderEntryFieldMappings.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Link an Extraction Type with Order Entry type field mappings
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Placeholder Text
            </label>
            <input
              type="text"
              value={field.placeholder || ''}
              onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
              placeholder="Enter placeholder text"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Help Text
            </label>
            <input
              type="text"
              value={field.helpText || ''}
              onChange={(e) => onChange({ ...field, helpText: e.target.value })}
              placeholder="Helper text shown below the field"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {field.fieldType === 'dropdown' && (
            <div className="space-y-4">
              <Select
                label="Display Mode"
                value={field.dropdownDisplayMode || 'description_only'}
                onValueChange={(value) => onChange({ ...field, dropdownDisplayMode: value as 'description_only' | 'value_and_description' })}
                options={[
                  { value: 'description_only', label: 'Show description only' },
                  { value: 'value_and_description', label: 'Show value and description' }
                ]}
                helpText="Controls how options appear to users in the dropdown"
                searchable={false}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dropdown Options
                </label>
                <div className="space-y-2">
                  {(field.dropdownOptions || []).map((opt: string | DropdownOption, index: number) => {
                    const optValue = typeof opt === 'string' ? opt : opt.value;
                    const optDesc = typeof opt === 'string' ? opt : opt.description;
                    return (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={optValue}
                          onChange={(e) => {
                            const newOptions = [...(field.dropdownOptions || [])];
                            newOptions[index] = { value: e.target.value, description: optDesc };
                            onChange({ ...field, dropdownOptions: newOptions });
                          }}
                          placeholder="Value"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <input
                          type="text"
                          value={optDesc}
                          onChange={(e) => {
                            const newOptions = [...(field.dropdownOptions || [])];
                            newOptions[index] = { value: optValue, description: e.target.value };
                            onChange({ ...field, dropdownOptions: newOptions });
                          }}
                          placeholder="Description"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newOptions = (field.dropdownOptions || []).filter((_: string | DropdownOption, i: number) => i !== index);
                            onChange({ ...field, dropdownOptions: newOptions });
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      const newOptions = [...(field.dropdownOptions || []), { value: '', description: '' }];
                      onChange({ ...field, dropdownOptions: newOptions });
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                    Add Option
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Value is sent to the API. Description is what users see.</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI Extraction Instructions
            </label>
            <textarea
              value={field.aiExtractionInstructions || ''}
              onChange={(e) => onChange({ ...field, aiExtractionInstructions: e.target.value })}
              placeholder="Instructions for AI to extract this field from PDFs"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {(field.fieldType === 'text' || field.fieldType === 'number') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Length
                </label>
                <input
                  type="number"
                  value={field.maxLength || ''}
                  onChange={(e) => onChange({ ...field, maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="No limit"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Value
              </label>
              <input
                type="text"
                value={field.defaultValue || ''}
                onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
                placeholder="Optional"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={field.isRequired || false}
                  onChange={(e) => onChange({ ...field, isRequired: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Copy From Field
            </label>
            <Select
              value={field.copyFromField || '__none__'}
              onValueChange={(value) => onChange({ ...field, copyFromField: value === '__none__' ? undefined : value })}
              options={[
                { value: '__none__', label: 'None' },
                ...allFields
                  .filter(f => f.id !== field.id && f.fieldType === field.fieldType)
                  .map(f => ({ value: f.fieldName, label: `${f.fieldLabel} (${f.fieldName})` }))
              ]}
              searchable
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Auto-populate this field when the selected field is filled in (must be same field type)
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !field.fieldName?.trim() || !field.fieldLabel?.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Field
          </button>
        </div>
      </div>
    </div>
  );
}
