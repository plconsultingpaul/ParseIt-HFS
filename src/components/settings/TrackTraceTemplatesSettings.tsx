import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, CreditCard as Edit2, GripVertical, AlertCircle, Save, Search, Filter, Columns2 as Columns, Settings, ChevronDown, ChevronRight, Copy, FileText, Lock, Eye, Loader2, ExternalLink, Zap } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { User, TrackTraceTemplate, TrackTraceTemplateField, TrackTraceTemplateDefaultField, TrackTraceFilterPreset, TrackTraceFilterPresetDefaultField, TrackTraceFilterValue, TrackTraceOrderByOption, SecondaryApiConfig, ApiSpec, ApiSpecEndpoint, ApiEndpointField, TrackTraceValueMapping } from '../../types';
import { supabase } from '../../lib/supabase';
import Select from '../common/Select';
import { FormSkeleton } from '../common/Skeleton';

interface SortableColumnItemProps {
  field: TrackTraceTemplateField;
  onEdit: (field: TrackTraceTemplateField) => void;
  onDelete: (id: string) => void;
}

function SortableColumnItem({ field, onEdit, onDelete }: SortableColumnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
    >
      <div className="flex items-center space-x-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
              {field.displayLabel}
            </span>
            <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
              {field.dataType}
            </span>
            {!field.isEnabled && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 rounded">
                Disabled
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            API Field: {field.fieldName}
          </span>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onEdit(field)}
          className="p-1.5 text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(field.id)}
          className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface TrackTraceTemplatesSettingsProps {
  currentUser: User;
}

export default function TrackTraceTemplatesSettings({ currentUser }: TrackTraceTemplatesSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TrackTraceTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [template, setTemplate] = useState<TrackTraceTemplate | null>(null);
  const [fields, setFields] = useState<TrackTraceTemplateField[]>([]);

  const [secondaryApis, setSecondaryApis] = useState<SecondaryApiConfig[]>([]);
  const [apiSpecs, setApiSpecs] = useState<ApiSpec[]>([]);
  const [apiEndpoints, setApiEndpoints] = useState<ApiSpecEndpoint[]>([]);

  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<TrackTraceTemplateField | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');

  const [defaultFields, setDefaultFields] = useState<TrackTraceTemplateDefaultField[]>([]);
  const [showDefaultFieldModal, setShowDefaultFieldModal] = useState(false);
  const [editingDefaultField, setEditingDefaultField] = useState<TrackTraceTemplateDefaultField | null>(null);
  const [endpointFields, setEndpointFields] = useState<ApiEndpointField[]>([]);
  const [schemaFieldPaths, setSchemaFieldPaths] = useState<string[]>([]);

  const [filterPresets, setFilterPresets] = useState<TrackTraceFilterPreset[]>([]);
  const [showFilterPresetModal, setShowFilterPresetModal] = useState(false);
  const [editingFilterPreset, setEditingFilterPreset] = useState<TrackTraceFilterPreset | null>(null);
  const [editingPresetDefaultFields, setEditingPresetDefaultFields] = useState<TrackTraceFilterPresetDefaultField[]>([]);

  const [expandedSections, setExpandedSections] = useState({
    api: false,
    options: false,
    filters: false,
    columns: false,
    defaultFields: false,
    filterPresets: false
  });

  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'template' | 'field' | 'defaultField' | 'filterPreset';
    id: string;
    name: string;
  } | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [mainApiSettings, setMainApiSettings] = useState<{ path: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadInitialData();
    loadActiveSchema();
    loadMainApiSettings();
  }, []);

  const loadActiveSchema = async () => {
    try {
      const { data, error } = await supabase
        .from('order_entry_json_schemas')
        .select('field_paths')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (data && Array.isArray(data.field_paths)) {
        setSchemaFieldPaths(data.field_paths);
      }
    } catch (err) {
      console.error('Failed to load active schema:', err);
    }
  };

  const loadMainApiSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('api_settings')
        .select('path')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setMainApiSettings(data);
      }
    } catch (err) {
      console.error('Failed to load main API settings:', err);
    }
  };

  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplate(selectedTemplateId);
    } else {
      setTemplate(null);
      setFields([]);
      setDefaultFields([]);
      setFilterPresets([]);
    }
  }, [selectedTemplateId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [templatesRes, apisRes, specsRes] = await Promise.all([
        supabase.from('track_trace_templates').select('*').order('name'),
        supabase.from('secondary_api_configs').select('*').eq('is_active', true).order('name'),
        supabase.from('api_specs').select('*').order('name')
      ]);

      if (templatesRes.error) throw templatesRes.error;
      if (apisRes.error) throw apisRes.error;
      if (specsRes.error) throw specsRes.error;

      const mappedTemplates: TrackTraceTemplate[] = (templatesRes.data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        apiSourceType: t.api_source_type,
        secondaryApiId: t.secondary_api_id,
        apiSpecId: t.api_spec_id,
        apiSpecEndpointId: t.api_spec_endpoint_id,
        apiPath: t.api_path,
        httpMethod: t.http_method,
        limitOptions: t.limit_options || [10, 25, 50, 100],
        orderByOptions: t.order_by_options || [],
        defaultLimit: t.default_limit,
        defaultOrderBy: t.default_order_by,
        defaultOrderDirection: t.default_order_direction,
        isActive: t.is_active,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }));

      setTemplates(mappedTemplates);
      setSecondaryApis(apisRes.data || []);
      setApiSpecs(specsRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = async (templateId: string) => {
    try {
      setError(null);
      const { data: templateData, error: templateError } = await supabase
        .from('track_trace_templates')
        .select('*')
        .eq('id', templateId)
        .maybeSingle();

      if (templateError) throw templateError;

      if (templateData) {
        const mappedTemplate: TrackTraceTemplate = {
          id: templateData.id,
          name: templateData.name,
          description: templateData.description,
          apiSourceType: templateData.api_source_type,
          secondaryApiId: templateData.secondary_api_id,
          apiSpecId: templateData.api_spec_id,
          apiSpecEndpointId: templateData.api_spec_endpoint_id,
          apiPath: templateData.api_path,
          httpMethod: templateData.http_method,
          limitOptions: templateData.limit_options || [10, 25, 50, 100],
          orderByOptions: templateData.order_by_options || [],
          defaultLimit: templateData.default_limit,
          defaultOrderBy: templateData.default_order_by,
          defaultOrderDirection: templateData.default_order_direction,
          isActive: templateData.is_active,
          showUrl: templateData.show_url || false,
          createdAt: templateData.created_at,
          updatedAt: templateData.updated_at
        };
        setTemplate(mappedTemplate);

        if (templateData.api_spec_id) {
          loadEndpointsForSpec(templateData.api_spec_id);
        }

        if (templateData.api_spec_endpoint_id) {
          loadEndpointFields(templateData.api_spec_endpoint_id);
        }

        const { data: fieldsData, error: fieldsError } = await supabase
          .from('track_trace_template_fields')
          .select('*')
          .eq('template_id', templateData.id)
          .order('field_order');

        if (fieldsError) throw fieldsError;

        const mappedFields: TrackTraceTemplateField[] = (fieldsData || []).map((f: any) => ({
          id: f.id,
          templateId: f.template_id,
          fieldType: f.field_type,
          fieldName: f.field_name,
          displayLabel: f.display_label,
          dataType: f.data_type,
          filterOperator: f.filter_operator,
          parameterType: f.parameter_type || 'query',
          apiFieldPath: f.api_field_path,
          isRequired: f.is_required,
          fieldOrder: f.field_order,
          isEnabled: f.is_enabled,
          valueMappings: f.value_mappings || [],
          createdAt: f.created_at,
          updatedAt: f.updated_at
        }));
        setFields(mappedFields);

        const { data: defaultFieldsData, error: defaultFieldsError } = await supabase
          .from('track_trace_template_default_fields')
          .select('*')
          .eq('template_id', templateData.id)
          .order('created_at');

        if (defaultFieldsError) throw defaultFieldsError;

        const mappedDefaultFields: TrackTraceTemplateDefaultField[] = (defaultFieldsData || []).map((f: any) => ({
          id: f.id,
          templateId: f.template_id,
          fieldName: f.field_name,
          parameterType: f.parameter_type,
          apiFieldPath: f.api_field_path,
          valueType: f.value_type,
          staticValue: f.static_value,
          dynamicValue: f.dynamic_value,
          operator: f.operator || 'eq',
          createdAt: f.created_at,
          updatedAt: f.updated_at
        }));
        setDefaultFields(mappedDefaultFields);

        const { data: filterPresetsData, error: filterPresetsError } = await supabase
          .from('track_trace_filter_presets')
          .select('*')
          .eq('template_id', templateData.id)
          .order('display_order');

        if (filterPresetsError) throw filterPresetsError;

        const mappedFilterPresets: TrackTraceFilterPreset[] = (filterPresetsData || []).map((p: any) => {
          let filterValues: TrackTraceFilterValue[] = [];
          const rawFilterValues = p.filter_values;
          if (Array.isArray(rawFilterValues)) {
            filterValues = rawFilterValues;
          } else if (rawFilterValues && typeof rawFilterValues === 'object') {
            filterValues = Object.entries(rawFilterValues).map(([fieldName, val]: [string, any]) => ({
              id: crypto.randomUUID(),
              fieldName,
              operator: val.operator || 'eq',
              value: val.value || ''
            }));
          }
          return {
            id: p.id,
            templateId: p.template_id,
            name: p.name,
            displayOrder: p.display_order,
            filterValues,
            isActive: p.is_active,
            createdAt: p.created_at,
            updatedAt: p.updated_at
          };
        });
        setFilterPresets(mappedFilterPresets);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load template');
    }
  };

  const loadEndpointsForSpec = async (specId: string) => {
    try {
      const { data, error } = await supabase
        .from('api_spec_endpoints')
        .select('*')
        .eq('api_spec_id', specId)
        .order('path');

      if (error) throw error;
      setApiEndpoints(data || []);
    } catch (err) {
      console.error('Failed to load endpoints:', err);
    }
  };

  const loadEndpointFields = async (endpointId: string) => {
    try {
      const { data, error } = await supabase
        .from('api_endpoint_fields')
        .select('*')
        .eq('api_spec_endpoint_id', endpointId)
        .order('field_name');

      if (error) throw error;
      setEndpointFields(data || []);
    } catch (err) {
      console.error('Failed to load endpoint fields:', err);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;

    try {
      setSaving(true);
      setError(null);

      const { data, error } = await supabase
        .from('track_trace_templates')
        .insert([{
          name: newTemplateName.trim(),
          description: newTemplateDescription.trim() || null,
          api_source_type: 'main',
          api_path: '',
          http_method: 'GET',
          limit_options: [10, 25, 50, 100],
          order_by_options: [],
          default_limit: 25,
          default_order_direction: 'desc',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      setShowCreateModal(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
      await loadInitialData();
      setSelectedTemplateId(data.id);
      setSuccessMessage('Template created successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!template) return;

    try {
      setSaving(true);
      setError(null);

      const templateData = {
        name: template.name,
        description: template.description || null,
        api_source_type: template.apiSourceType,
        secondary_api_id: template.apiSourceType === 'secondary' ? template.secondaryApiId : null,
        api_spec_id: template.apiSpecId || null,
        api_spec_endpoint_id: template.apiSpecEndpointId || null,
        api_path: template.apiPath,
        http_method: template.httpMethod,
        limit_options: template.limitOptions,
        order_by_options: template.orderByOptions,
        default_limit: template.defaultLimit,
        default_order_by: template.defaultOrderBy || null,
        default_order_direction: template.defaultOrderDirection,
        is_active: template.isActive,
        show_url: template.showUrl,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('track_trace_templates')
        .update(templateData)
        .eq('id', template.id);

      if (error) throw error;

      await loadInitialData();
      setSuccessMessage('Template saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = () => {
    if (!template) return;
    setDeleteTarget({ type: 'template', id: template.id, name: template.name });
  };

  const confirmDeleteTemplate = async () => {
    if (!template) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('track_trace_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      setSelectedTemplateId('');
      setTemplate(null);
      setFields([]);
      setDeleteTarget(null);
      await loadInitialData();
      setSuccessMessage('Template deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete template');
    } finally {
      setSaving(false);
    }
  };

  const handleAddField = (fieldType: 'filter' | 'select') => {
    const newField: TrackTraceTemplateField = {
      id: '',
      templateId: template?.id || '',
      fieldType,
      fieldName: '',
      displayLabel: '',
      dataType: 'string',
      filterOperator: fieldType === 'filter' ? 'eq' : undefined,
      parameterType: fieldType === 'filter' ? '$filter' : '$select',
      apiFieldPath: undefined,
      isRequired: false,
      fieldOrder: fields.filter(f => f.fieldType === fieldType).length,
      isEnabled: true,
      createdAt: '',
      updatedAt: ''
    };
    setEditingField(newField);
    setShowFieldModal(true);
  };

  const handleEditField = (field: TrackTraceTemplateField) => {
    setEditingField({ ...field });
    setShowFieldModal(true);
  };

  const handleSaveField = async () => {
    if (!editingField || !template?.id) return;

    try {
      setSaving(true);
      setError(null);

      const fieldData = {
        template_id: template.id,
        field_type: editingField.fieldType,
        field_name: editingField.fieldName,
        display_label: editingField.displayLabel,
        data_type: editingField.dataType,
        filter_operator: editingField.fieldType === 'filter' ? editingField.filterOperator : null,
        parameter_type: editingField.parameterType || 'query',
        api_field_path: editingField.apiFieldPath || null,
        is_required: editingField.isRequired,
        field_order: editingField.fieldOrder,
        is_enabled: editingField.isEnabled,
        value_mappings: editingField.valueMappings || [],
        updated_at: new Date().toISOString()
      };

      if (editingField.id) {
        const { error } = await supabase
          .from('track_trace_template_fields')
          .update(fieldData)
          .eq('id', editingField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('track_trace_template_fields')
          .insert([{ ...fieldData, created_at: new Date().toISOString() }]);
        if (error) throw error;
      }

      setShowFieldModal(false);
      setEditingField(null);
      await loadTemplate(selectedTemplateId);
    } catch (err: any) {
      setError(err.message || 'Failed to save field');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    setDeleteTarget({ type: 'field', id: fieldId, name: field.displayLabel || field.fieldName });
  };

  const confirmDeleteField = async (fieldId: string) => {
    try {
      const { error } = await supabase
        .from('track_trace_template_fields')
        .delete()
        .eq('id', fieldId);
      if (error) throw error;
      setDeleteTarget(null);
      await loadTemplate(selectedTemplateId);
    } catch (err: any) {
      setError(err.message || 'Failed to delete field');
    }
  };

  const handleAddDefaultField = () => {
    const newField: TrackTraceTemplateDefaultField = {
      id: '',
      templateId: template?.id || '',
      fieldName: '',
      parameterType: 'query',
      apiFieldPath: undefined,
      valueType: 'static',
      staticValue: '',
      dynamicValue: undefined,
      operator: 'eq',
      createdAt: '',
      updatedAt: ''
    };
    setEditingDefaultField(newField);
    setShowDefaultFieldModal(true);
  };

  const handleEditDefaultField = (field: TrackTraceTemplateDefaultField) => {
    setEditingDefaultField({ ...field });
    setShowDefaultFieldModal(true);
  };

  const handleSaveDefaultField = async () => {
    if (!editingDefaultField || !template?.id) return;

    try {
      setSaving(true);
      setError(null);

      const fieldData = {
        template_id: template.id,
        field_name: editingDefaultField.fieldName,
        parameter_type: editingDefaultField.parameterType,
        api_field_path: editingDefaultField.apiFieldPath || null,
        value_type: editingDefaultField.valueType,
        static_value: editingDefaultField.valueType === 'static' ? editingDefaultField.staticValue : null,
        dynamic_value: editingDefaultField.valueType === 'dynamic' ? editingDefaultField.dynamicValue : null,
        operator: editingDefaultField.operator || 'eq',
        updated_at: new Date().toISOString()
      };

      if (editingDefaultField.id) {
        const { error } = await supabase
          .from('track_trace_template_default_fields')
          .update(fieldData)
          .eq('id', editingDefaultField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('track_trace_template_default_fields')
          .insert([{ ...fieldData, created_at: new Date().toISOString() }]);
        if (error) throw error;
      }

      setShowDefaultFieldModal(false);
      setEditingDefaultField(null);
      await loadTemplate(selectedTemplateId);
      setSuccessMessage('Default field saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save default field');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDefaultField = (fieldId: string) => {
    const field = defaultFields.find(f => f.id === fieldId);
    if (!field) return;
    setDeleteTarget({ type: 'defaultField', id: fieldId, name: field.fieldName });
  };

  const confirmDeleteDefaultField = async (fieldId: string) => {
    try {
      const { error } = await supabase
        .from('track_trace_template_default_fields')
        .delete()
        .eq('id', fieldId);
      if (error) throw error;
      setDeleteTarget(null);
      await loadTemplate(selectedTemplateId);
      setSuccessMessage('Default field deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete default field');
    }
  };

  const handleAddFilterPreset = () => {
    const newPreset: TrackTraceFilterPreset = {
      id: '',
      templateId: template?.id || '',
      name: '',
      displayOrder: filterPresets.length,
      filterValues: [],
      isActive: true,
      createdAt: '',
      updatedAt: ''
    };
    setEditingFilterPreset(newPreset);
    setEditingPresetDefaultFields([]);
    setShowFilterPresetModal(true);
  };

  const handleEditFilterPreset = async (preset: TrackTraceFilterPreset) => {
    setEditingFilterPreset({ ...preset });
    setEditingPresetDefaultFields([]);
    setShowFilterPresetModal(true);

    if (preset.id) {
      try {
        const { data, error } = await supabase
          .from('track_trace_filter_preset_default_fields')
          .select('*')
          .eq('preset_id', preset.id)
          .order('created_at');

        if (error) throw error;

        const mappedFields: TrackTraceFilterPresetDefaultField[] = (data || []).map((f: any) => ({
          id: f.id,
          presetId: f.preset_id,
          fieldName: f.field_name,
          parameterType: f.parameter_type,
          apiFieldPath: f.api_field_path,
          valueType: f.value_type,
          staticValue: f.static_value,
          dynamicValue: f.dynamic_value,
          createdAt: f.created_at,
          updatedAt: f.updated_at
        }));
        setEditingPresetDefaultFields(mappedFields);
      } catch (err) {
        console.error('Failed to load preset default fields:', err);
      }
    }
  };

  const handleSaveFilterPreset = async () => {
    if (!editingFilterPreset || !template?.id) return;

    try {
      setSaving(true);
      setError(null);

      const presetData = {
        template_id: template.id,
        name: editingFilterPreset.name,
        display_order: editingFilterPreset.displayOrder,
        filter_values: editingFilterPreset.filterValues,
        is_active: editingFilterPreset.isActive,
        updated_at: new Date().toISOString()
      };

      let presetId = editingFilterPreset.id;

      if (editingFilterPreset.id) {
        const { error } = await supabase
          .from('track_trace_filter_presets')
          .update(presetData)
          .eq('id', editingFilterPreset.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('track_trace_filter_presets')
          .insert([{ ...presetData, created_at: new Date().toISOString() }])
          .select('id')
          .single();
        if (error) throw error;
        presetId = data.id;
      }

      if (presetId) {
        await supabase
          .from('track_trace_filter_preset_default_fields')
          .delete()
          .eq('preset_id', presetId);

        if (editingPresetDefaultFields.length > 0) {
          const fieldsToInsert = editingPresetDefaultFields.map(field => ({
            preset_id: presetId,
            field_name: field.fieldName,
            parameter_type: field.parameterType,
            api_field_path: field.apiFieldPath || null,
            value_type: field.valueType,
            static_value: field.staticValue || null,
            dynamic_value: field.dynamicValue || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          const { error: fieldsError } = await supabase
            .from('track_trace_filter_preset_default_fields')
            .insert(fieldsToInsert);
          if (fieldsError) throw fieldsError;
        }
      }

      setShowFilterPresetModal(false);
      setEditingFilterPreset(null);
      setEditingPresetDefaultFields([]);
      await loadTemplate(selectedTemplateId);
      setSuccessMessage('Quick filter button saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save quick filter button');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFilterPreset = (presetId: string) => {
    const preset = filterPresets.find(p => p.id === presetId);
    if (!preset) return;
    setDeleteTarget({ type: 'filterPreset', id: presetId, name: preset.name });
  };

  const confirmDeleteFilterPreset = async (presetId: string) => {
    try {
      const { error } = await supabase
        .from('track_trace_filter_presets')
        .delete()
        .eq('id', presetId);
      if (error) throw error;
      setDeleteTarget(null);
      await loadTemplate(selectedTemplateId);
      setSuccessMessage('Quick filter button deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete quick filter button');
    }
  };

  const handleAddOrderByOption = () => {
    if (!template) return;
    setTemplate({
      ...template,
      orderByOptions: [
        ...template.orderByOptions,
        { field: '', label: '', defaultDirection: 'desc' }
      ]
    });
  };

  const handleUpdateOrderByOption = (index: number, updates: Partial<TrackTraceOrderByOption>) => {
    if (!template) return;
    const newOptions = [...template.orderByOptions];
    newOptions[index] = { ...newOptions[index], ...updates };
    setTemplate({ ...template, orderByOptions: newOptions });
  };

  const handleRemoveOrderByOption = (index: number) => {
    if (!template) return;
    const newOptions = template.orderByOptions.filter((_, i) => i !== index);
    setTemplate({ ...template, orderByOptions: newOptions });
  };

  const handleColumnReorder = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const selectFields = fields.filter(f => f.fieldType === 'select');
    const oldIndex = selectFields.findIndex(f => f.id === active.id);
    const newIndex = selectFields.findIndex(f => f.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedSelectFields = arrayMove(selectFields, oldIndex, newIndex);
    const filterFieldsList = fields.filter(f => f.fieldType === 'filter');
    const updatedSelectFields = reorderedSelectFields.map((field, index) => ({
      ...field,
      fieldOrder: index
    }));

    setFields([...filterFieldsList, ...updatedSelectFields]);

    try {
      const updates = updatedSelectFields.map(field =>
        supabase
          .from('track_trace_template_fields')
          .update({ field_order: field.fieldOrder, updated_at: new Date().toISOString() })
          .eq('id', field.id)
      );
      await Promise.all(updates);
    } catch (err) {
      console.error('Failed to save column order:', err);
      setError('Failed to save column order');
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const buildPreviewUrl = (): string => {
    if (!template) return '';

    let baseUrl = '';
    if (template.apiSourceType === 'secondary' && template.secondaryApiId) {
      const secondaryApi = secondaryApis.find(a => a.id === template.secondaryApiId);
      baseUrl = secondaryApi?.baseUrl || '';
    } else {
      baseUrl = mainApiSettings?.path || '';
    }

    if (!baseUrl && !template.apiPath) return '';

    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = template.apiPath.startsWith('/') ? template.apiPath : `/${template.apiPath}`;
    let url = normalizedBase + normalizedPath;

    const queryParams: string[] = [];
    const filterParts: string[] = [];

    const enabledFilterFields = fields.filter(f => f.fieldType === 'filter' && f.isEnabled && f.parameterType === '$filter');
    enabledFilterFields.forEach(field => {
      const fieldName = field.apiFieldPath || field.fieldName;
      const operator = field.filterOperator || 'eq';
      if (operator === 'contains' || operator === 'startswith' || operator === 'endswith') {
        filterParts.push(`${operator}(${fieldName}, '{${field.displayLabel}}')`);
      } else {
        filterParts.push(`${fieldName} ${operator} '{${field.displayLabel}}'`);
      }
    });

    const queryDefaultFields = defaultFields.filter(f => f.parameterType === 'query');
    queryDefaultFields.forEach(field => {
      const value = field.valueType === 'static' ? field.staticValue : `{${field.dynamicValue}}`;
      if (!value) return;
      const rawFieldName = field.apiFieldPath || field.fieldName;
      const fieldName = rawFieldName.replace(/^\[.*?\]\s*/, '');
      const operator = field.operator || 'eq';
      if (operator === 'contains' || operator === 'startswith' || operator === 'endswith') {
        filterParts.push(`${operator}(${fieldName}, '${value}')`);
      } else if (operator === 'not contains') {
        filterParts.push(`not contains(${fieldName}, '${value}')`);
      } else if (operator === 'not startswith') {
        filterParts.push(`not startswith(${fieldName}, '${value}')`);
      } else if (operator === 'not endswith') {
        filterParts.push(`not endswith(${fieldName}, '${value}')`);
      } else {
        filterParts.push(`${fieldName} ${operator} '${value}'`);
      }
    });

    if (filterParts.length > 0) {
      queryParams.push(`$filter=${filterParts.join(' and ')}`);
    }

    const enabledSelectFields = fields.filter(f => f.fieldType === 'select' && f.isEnabled);
    if (enabledSelectFields.length > 0) {
      const selectFieldNames = enabledSelectFields.map(f => f.apiFieldPath || f.fieldName);
      queryParams.push(`$select=${selectFieldNames.join(',')}`);
    }

    if (template.defaultLimit) {
      queryParams.push(`$limit=${template.defaultLimit}`);
    }

    if (template.defaultOrderBy) {
      queryParams.push(`$orderby=${template.defaultOrderBy} ${template.defaultOrderDirection || 'desc'}`);
    }

    fields.filter(f => f.fieldType === 'filter' && f.isEnabled && f.parameterType === 'query').forEach(field => {
      queryParams.push(`${field.fieldName}={${field.displayLabel}}`);
    });

    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }

    return url;
  };

  if (loading) {
    return <FormSkeleton fields={6} />;
  }

  const filterFields = fields.filter(f => f.fieldType === 'filter');
  const selectFields = fields.filter(f => f.fieldType === 'select');

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm text-green-700 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Track & Trace Templates</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create reusable templates that can be assigned to multiple clients
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {selectedTemplateId && template && (
              <>
                <button
                  onClick={handleDeleteTemplate}
                  disabled={saving}
                  className="flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Template
                </button>
                <button
                  onClick={() => setShowPreviewModal(true)}
                  disabled={filterFields.length === 0 && selectFields.length === 0}
                  className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={saving || !template.name.trim()}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Template
          </label>
          <Select
            value={selectedTemplateId || '__none__'}
            onValueChange={(value) => setSelectedTemplateId(value === '__none__' ? '' : value)}
            options={[
              { value: '__none__', label: 'Select a template...' },
              ...templates.map(t => ({ value: t.id, label: `${t.name}${t.isActive ? '' : ' (Inactive)'}` }))
            ]}
            searchable
          />
        </div>

        {selectedTemplateId && template && (
          <>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={template.name}
                    onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={template.description || ''}
                    onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                    placeholder="Optional description"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => toggleSection('api')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center space-x-3">
                    <Settings className="h-5 w-5 text-gray-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">API Configuration</span>
                  </div>
                  {expandedSections.api ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>

                {expandedSections.api && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          API Source
                        </label>
                        <Select
                          value={template.apiSourceType}
                          onValueChange={(value) => setTemplate({ ...template, apiSourceType: value as 'main' | 'secondary' })}
                          options={[
                            { value: 'main', label: 'Main API' },
                            { value: 'secondary', label: 'Secondary API' }
                          ]}
                        />
                      </div>

                      {template.apiSourceType === 'secondary' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Secondary API
                          </label>
                          <Select
                            value={template.secondaryApiId || '__none__'}
                            onValueChange={(value) => setTemplate({ ...template, secondaryApiId: value === '__none__' ? undefined : value })}
                            options={[
                              { value: '__none__', label: 'Select API...' },
                              ...secondaryApis.map(a => ({ value: a.id || '__none__', label: a.name }))
                            ]}
                            searchable
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          API Spec (Optional)
                        </label>
                        <Select
                          value={template.apiSpecId || '__none__'}
                          onValueChange={(value) => {
                            const specId = value === '__none__' ? undefined : value;
                            setTemplate({ ...template, apiSpecId: specId, apiSpecEndpointId: undefined });
                            if (specId) {
                              loadEndpointsForSpec(specId);
                            } else {
                              setApiEndpoints([]);
                              setEndpointFields([]);
                            }
                          }}
                          options={[
                            { value: '__none__', label: 'None (Manual entry)' },
                            ...apiSpecs.map(s => ({ value: s.id, label: s.name }))
                          ]}
                          searchable
                        />
                      </div>

                      {template.apiSpecId && apiEndpoints.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Endpoint
                          </label>
                          <Select
                            value={template.apiSpecEndpointId || '__none__'}
                            onValueChange={(value) => {
                              const endpointId = value === '__none__' ? undefined : value;
                              const endpoint = apiEndpoints.find(e => e.id === endpointId);
                              setTemplate({
                                ...template,
                                apiSpecEndpointId: endpointId,
                                apiPath: endpoint?.path || template.apiPath,
                                httpMethod: endpoint?.method?.toUpperCase() || template.httpMethod
                              });
                              if (endpointId) {
                                loadEndpointFields(endpointId);
                              } else {
                                setEndpointFields([]);
                              }
                            }}
                            options={[
                              { value: '__none__', label: 'Select endpoint...' },
                              ...apiEndpoints.map(e => ({
                                value: e.id,
                                label: `${e.method.toUpperCase()} ${e.path}`
                              }))
                            ]}
                            searchable
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          HTTP Method
                        </label>
                        <Select
                          value={template.httpMethod}
                          onValueChange={(value) => setTemplate({ ...template, httpMethod: value })}
                          options={[
                            { value: 'GET', label: 'GET' },
                            { value: 'POST', label: 'POST' }
                          ]}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          API Path
                        </label>
                        <input
                          type="text"
                          value={template.apiPath}
                          onChange={(e) => setTemplate({ ...template, apiPath: e.target.value })}
                          placeholder="/api/orders"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center mt-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={template.isActive}
                          onChange={(e) => setTemplate({ ...template, isActive: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Template is active (available for assignment)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => toggleSection('options')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center space-x-3">
                    <Search className="h-5 w-5 text-gray-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">Query Options</span>
                  </div>
                  {expandedSections.options ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>

                {expandedSections.options && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Limit Options (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={template.limitOptions.join(', ')}
                          onChange={(e) => {
                            const values = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                            setTemplate({ ...template, limitOptions: values.length > 0 ? values : [10, 25, 50, 100] });
                          }}
                          placeholder="10, 25, 50, 100"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Default Limit
                        </label>
                        <Select
                          value={String(template.defaultLimit)}
                          onValueChange={(value) => setTemplate({ ...template, defaultLimit: parseInt(value) })}
                          options={template.limitOptions.map(l => ({ value: String(l), label: String(l) }))}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Order By Options
                        </label>
                        <button
                          onClick={handleAddOrderByOption}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          + Add Option
                        </button>
                      </div>

                      {template.orderByOptions.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No order by options configured</p>
                      ) : (
                        <div className="space-y-2">
                          {template.orderByOptions.map((opt, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={opt.field}
                                onChange={(e) => handleUpdateOrderByOption(idx, { field: e.target.value })}
                                placeholder="Field name"
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                              />
                              <input
                                type="text"
                                value={opt.label}
                                onChange={(e) => handleUpdateOrderByOption(idx, { label: e.target.value })}
                                placeholder="Display label"
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                              />
                              <select
                                value={opt.defaultDirection}
                                onChange={(e) => handleUpdateOrderByOption(idx, { defaultDirection: e.target.value as 'asc' | 'desc' })}
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                              >
                                <option value="asc">ASC</option>
                                <option value="desc">DESC</option>
                              </select>
                              <button
                                onClick={() => handleRemoveOrderByOption(idx)}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {template.orderByOptions.length > 0 && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Default Order By
                          </label>
                          <Select
                            value={template.defaultOrderBy || '__none__'}
                            onValueChange={(value) => setTemplate({ ...template, defaultOrderBy: value === '__none__' ? undefined : value })}
                            options={[
                              { value: '__none__', label: 'None' },
                              ...template.orderByOptions.filter(o => o.field).map(o => ({ value: o.field, label: o.label || o.field }))
                            ]}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Default Direction
                          </label>
                          <Select
                            value={template.defaultOrderDirection}
                            onValueChange={(value) => setTemplate({ ...template, defaultOrderDirection: value as 'asc' | 'desc' })}
                            options={[
                              { value: 'asc', label: 'Ascending' },
                              { value: 'desc', label: 'Descending' }
                            ]}
                          />
                        </div>
                      </div>
                    )}

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.showUrl}
                          onChange={(e) => setTemplate({ ...template, showUrl: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Show URL</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Display the API request URL on the Track & Trace page for debugging</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => toggleSection('filters')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center space-x-3">
                    <Filter className="h-5 w-5 text-gray-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      Filter Fields ({filterFields.length})
                    </span>
                  </div>
                  {expandedSections.filters ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>

                {expandedSections.filters && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => handleAddField('filter')}
                        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Filter
                      </button>
                    </div>

                    {filterFields.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">
                        No filter fields configured. Add filters to allow searching.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filterFields.map(field => (
                          <div
                            key={field.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                    {field.displayLabel}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                                    {field.dataType}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
                                    {field.filterOperator}
                                  </span>
                                  {field.isRequired && (
                                    <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                                      Required
                                    </span>
                                  )}
                                  {!field.isEnabled && (
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 rounded">
                                      Disabled
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  API Field: {field.fieldName}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditField(field)}
                                className="p-1.5 text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteField(field.id)}
                                className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => toggleSection('columns')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center space-x-3">
                    <Columns className="h-5 w-5 text-gray-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      Result Columns ({selectFields.length})
                    </span>
                  </div>
                  {expandedSections.columns ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>

                {expandedSections.columns && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => handleAddField('select')}
                        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Column
                      </button>
                    </div>

                    {selectFields.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">
                        No columns configured. Add columns to display in results.
                      </p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleColumnReorder}
                      >
                        <SortableContext
                          items={selectFields.map(f => f.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {selectFields.map(field => (
                              <SortableColumnItem
                                key={field.id}
                                field={field}
                                onEdit={handleEditField}
                                onDelete={handleDeleteField}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                )}
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => toggleSection('defaultFields')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center space-x-3">
                    <Lock className="h-5 w-5 text-gray-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      Default Fields ({defaultFields.length})
                    </span>
                  </div>
                  {expandedSections.defaultFields ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>

                {expandedSections.defaultFields && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Default fields are automatically sent with every API request. Client users cannot see or modify these values.
                    </p>
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={handleAddDefaultField}
                        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Default Field
                      </button>
                    </div>

                    {defaultFields.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">
                        No default fields configured. Add fields to pass hidden values to the API.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {defaultFields.map(field => (
                          <div
                            key={field.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <Lock className="h-4 w-4 text-gray-400" />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                    {field.fieldName}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                                    {field.parameterType}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    field.valueType === 'dynamic'
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                      : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                  }`}>
                                    {field.valueType === 'dynamic' ? 'Dynamic' : 'Static'}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {field.apiFieldPath && `API Field: ${field.apiFieldPath} | `}
                                  Value: {field.valueType === 'dynamic' ? field.dynamicValue : field.staticValue}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditDefaultField(field)}
                                className="p-1.5 text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDefaultField(field.id)}
                                className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={() => toggleSection('filterPresets')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center space-x-3">
                    <Zap className="h-5 w-5 text-gray-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      Quick Filter Buttons ({filterPresets.length})
                    </span>
                  </div>
                  {expandedSections.filterPresets ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>

                {expandedSections.filterPresets && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Quick filter buttons appear at the top of the Track & Trace page. When clicked, they apply pre-configured filter values that customers cannot change.
                    </p>
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={handleAddFilterPreset}
                        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Quick Filter
                      </button>
                    </div>

                    {filterPresets.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">
                        No quick filter buttons configured. Add buttons to give customers preset search options.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filterPresets.map(preset => (
                          <div
                            key={preset.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <Zap className="h-4 w-4 text-amber-500" />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                    {preset.name}
                                  </span>
                                  {!preset.isActive && (
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 rounded">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {preset.filterValues.length} filter value(s) configured
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditFilterPreset(preset)}
                                className="p-1.5 text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteFilterPreset(preset.id)}
                                className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-start space-x-2 mb-2">
                  <ExternalLink className="w-4 h-4 text-slate-600 dark:text-slate-400 flex-shrink-0 mt-0.5" />
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Full URL Preview:
                  </label>
                </div>
                <div className="ml-6 p-2 bg-white dark:bg-gray-900 border border-slate-300 dark:border-slate-600 rounded font-mono text-xs text-slate-900 dark:text-slate-100 break-all">
                  {buildPreviewUrl() || 'Configure API path and fields to see URL preview'}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 ml-6">
                  Values in curly braces like {'{Field Name}'} will be replaced with user input at runtime.
                </p>
              </div>
            </div>
          </>
        )}

        {!selectedTemplateId && (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Select a template to edit or create a new one</p>
          </div>
        )}
      </div>

      {showCreateModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Create New Template
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g., Standard TruckMate Template"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={newTemplateDescription}
                  onChange={(e) => setNewTemplateDescription(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTemplateName('');
                  setNewTemplateDescription('');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!newTemplateName.trim() || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showFieldModal && editingField && (
        <TemplateFieldEditModal
          field={editingField}
          onChange={setEditingField}
          onSave={handleSaveField}
          onClose={() => {
            setShowFieldModal(false);
            setEditingField(null);
          }}
          saving={saving}
          endpointFields={endpointFields}
          schemaFieldPaths={schemaFieldPaths}
        />
      )}

      {showDefaultFieldModal && editingDefaultField && (
        <DefaultFieldEditModal
          field={editingDefaultField}
          onChange={setEditingDefaultField}
          onSave={handleSaveDefaultField}
          onClose={() => {
            setShowDefaultFieldModal(false);
            setEditingDefaultField(null);
          }}
          saving={saving}
          endpointFields={endpointFields}
        />
      )}

      {showFilterPresetModal && editingFilterPreset && (
        <FilterPresetEditModal
          preset={editingFilterPreset}
          onChange={setEditingFilterPreset}
          onSave={handleSaveFilterPreset}
          onClose={() => {
            setShowFilterPresetModal(false);
            setEditingFilterPreset(null);
            setEditingPresetDefaultFields([]);
          }}
          saving={saving}
          filterFields={filterFields}
          defaultFields={editingPresetDefaultFields}
          onDefaultFieldsChange={setEditingPresetDefaultFields}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          type={deleteTarget.type}
          name={deleteTarget.name}
          onConfirm={() => {
            if (deleteTarget.type === 'template') {
              confirmDeleteTemplate();
            } else if (deleteTarget.type === 'field') {
              confirmDeleteField(deleteTarget.id);
            } else if (deleteTarget.type === 'defaultField') {
              confirmDeleteDefaultField(deleteTarget.id);
            } else if (deleteTarget.type === 'filterPreset') {
              confirmDeleteFilterPreset(deleteTarget.id);
            }
          }}
          onCancel={() => setDeleteTarget(null)}
          saving={saving}
        />
      )}

      {showPreviewModal && template && (
        <TrackTracePreviewModal
          template={template}
          filterFields={filterFields}
          selectFields={selectFields}
          defaultFields={defaultFields}
          filterPresets={filterPresets}
          secondaryApis={secondaryApis}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}

interface TemplateFieldEditModalProps {
  field: TrackTraceTemplateField;
  onChange: (field: TrackTraceTemplateField) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  endpointFields: ApiEndpointField[];
  schemaFieldPaths: string[];
}

function TemplateFieldEditModal({ field, onChange, onSave, onClose, saving, endpointFields, schemaFieldPaths }: TemplateFieldEditModalProps) {
  const formatDisplayLabel = (fieldName: string): string => {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const filterOperators = [
    { value: 'eq', label: 'Equals (eq)' },
    { value: 'ne', label: 'Not Equals (ne)' },
    { value: 'contains', label: 'Contains' },
    { value: 'startswith', label: 'Starts With' },
    { value: 'endswith', label: 'Ends With' },
    { value: 'gt', label: 'Greater Than (gt)' },
    { value: 'ge', label: 'Greater Than or Equal (ge)' },
    { value: 'lt', label: 'Less Than (lt)' },
    { value: 'le', label: 'Less Than or Equal (le)' }
  ];

  const dataTypes = [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Boolean' }
  ];

  const parameterTypes = [
    { value: '$filter', label: '$filter (OData Filter)' },
    { value: '$select', label: '$select (OData Select)' },
    { value: '$orderBy', label: '$orderBy (OData Order By)' },
    { value: 'query', label: 'Query Parameter' },
    { value: 'path', label: 'Path Variable' },
    { value: 'header', label: 'Request Header' },
    { value: 'body', label: 'Request Body' }
  ];

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {field.id ? 'Edit' : 'Add'} {field.fieldType === 'filter' ? 'Filter' : 'Column'} Field
          </h3>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Display Label *
            </label>
            <input
              type="text"
              value={field.displayLabel}
              onChange={(e) => onChange({ ...field, displayLabel: e.target.value })}
              placeholder="e.g., Order Number"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Type
            </label>
            <Select
              value={field.dataType}
              onValueChange={(value) => onChange({ ...field, dataType: value as any })}
              options={dataTypes}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Parameter Type *
            </label>
            <Select
              value={field.parameterType || '$filter'}
              onValueChange={(value) => onChange({ ...field, parameterType: value as any })}
              options={parameterTypes}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Field (from Spec)
            </label>
            {(() => {
              const isODataType = ['$filter', '$select', '$orderBy'].includes(field.parameterType || '');
              const isStandardParamType = ['query', 'path', 'header'].includes(field.parameterType || '');
              const useEndpointFields = isODataType || isStandardParamType;
              const filteredEndpointFields = useEndpointFields
                ? endpointFields.filter(f => {
                    if (isODataType) {
                      return f.field_path && !f.field_path.startsWith('[query]') && !f.field_path.startsWith('[path]') && !f.field_path.startsWith('[header]');
                    }
                    return f.field_path?.startsWith(`[${field.parameterType}]`);
                  })
                : [];
              const hasOptions = useEndpointFields ? filteredEndpointFields.length > 0 : schemaFieldPaths.length > 0;

              if (!hasOptions) {
                return (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    {useEndpointFields
                      ? `No ${field.parameterType} parameters found in API spec.`
                      : 'No API schema configured. Upload a JSON schema in Settings to see available fields.'}
                  </p>
                );
              }

              return (
                <Select
                  value={field.apiFieldPath || '__none__'}
                  onValueChange={(value) => {
                    if (useEndpointFields) {
                      const selectedField = filteredEndpointFields.find(f => f.field_name === value);
                      onChange({
                        ...field,
                        apiFieldPath: value === '__none__' ? undefined : value,
                        fieldName: value !== '__none__' ? value : field.fieldName,
                        displayLabel: value !== '__none__' && !field.displayLabel
                          ? formatDisplayLabel(selectedField?.field_name || value)
                          : field.displayLabel
                      });
                    } else {
                      const extractedFieldName = value !== '__none__' ? (value.split('.').pop()?.replace('[]', '') || value) : '';
                      const newDisplayLabel = value !== '__none__' && !field.displayLabel ? formatDisplayLabel(extractedFieldName) : field.displayLabel;
                      onChange({
                        ...field,
                        apiFieldPath: value === '__none__' ? undefined : value,
                        fieldName: value !== '__none__' ? extractedFieldName : field.fieldName,
                        displayLabel: newDisplayLabel
                      });
                    }
                  }}
                  options={[
                    { value: '__none__', label: 'Manual entry' },
                    ...(useEndpointFields
                      ? filteredEndpointFields.map(f => ({
                          value: f.field_name,
                          label: `${f.field_name}${f.description ? ` - ${f.description.slice(0, 50)}${f.description.length > 50 ? '...' : ''}` : ''}`
                        }))
                      : schemaFieldPaths.map(path => ({
                          value: path,
                          label: path
                        })))
                  ]}
                  searchable
                />
              );
            })()}
          </div>

          {!field.apiFieldPath && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Field Name *
              </label>
              <input
                type="text"
                value={field.fieldName}
                onChange={(e) => onChange({ ...field, fieldName: e.target.value })}
                placeholder="e.g., billNumber"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {field.fieldType === 'filter' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Filter Operator
                </label>
                <Select
                  value={field.filterOperator || 'eq'}
                  onValueChange={(value) => onChange({ ...field, filterOperator: value })}
                  options={filterOperators}
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={field.isRequired}
                    onChange={(e) => onChange({ ...field, isRequired: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Required field</span>
                </label>
              </div>
            </>
          )}

          <div className="flex items-center">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={field.isEnabled}
                onChange={(e) => onChange({ ...field, isEnabled: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
            </label>
          </div>

          {field.fieldType === 'select' && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Value Mappings
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const newMapping: TrackTraceValueMapping = { sourceValue: '', displayValue: '' };
                    onChange({ ...field, valueMappings: [...(field.valueMappings || []), newMapping] });
                  }}
                  className="flex items-center text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Mapping
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Transform API values to user-friendly display values
              </p>
              {(field.valueMappings && field.valueMappings.length > 0) ? (
                <div className="space-y-2">
                  {field.valueMappings.map((mapping, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={mapping.sourceValue}
                        onChange={(e) => {
                          const updated = [...(field.valueMappings || [])];
                          updated[index] = { ...updated[index], sourceValue: e.target.value };
                          onChange({ ...field, valueMappings: updated });
                        }}
                        placeholder="API value"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-400 text-sm">→</span>
                      <input
                        type="text"
                        value={mapping.displayValue}
                        onChange={(e) => {
                          const updated = [...(field.valueMappings || [])];
                          updated[index] = { ...updated[index], displayValue: e.target.value };
                          onChange({ ...field, valueMappings: updated });
                        }}
                        placeholder="Display value"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (field.valueMappings || []).filter((_, i) => i !== index);
                          onChange({ ...field, valueMappings: updated });
                        }}
                        className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  No mappings configured. Values will display as returned by the API.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!field.fieldName.trim() || !field.displayLabel.trim() || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Field'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface DefaultFieldEditModalProps {
  field: TrackTraceTemplateDefaultField;
  onChange: (field: TrackTraceTemplateDefaultField) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  endpointFields: ApiEndpointField[];
}

function DefaultFieldEditModal({ field, onChange, onSave, onClose, saving, endpointFields }: DefaultFieldEditModalProps) {
  const parameterTypes = [
    { value: 'query', label: 'Query Parameter' },
    { value: 'path', label: 'Path Variable' },
    { value: 'header', label: 'Request Header' },
    { value: 'body', label: 'Request Body' }
  ];

  const dynamicValueOptions = [
    { value: 'client.client_id', label: 'Client ID (from logged-in user)' }
  ];

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {field.id ? 'Edit' : 'Add'} Default Field
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Default fields are sent automatically with every API request.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Field Name *
            </label>
            <input
              type="text"
              value={field.fieldName}
              onChange={(e) => onChange({ ...field, fieldName: e.target.value })}
              placeholder="e.g., customerId"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Parameter Type *
            </label>
            <Select
              value={field.parameterType}
              onValueChange={(value) => onChange({ ...field, parameterType: value as any })}
              options={parameterTypes}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API Field (from Spec)
            </label>
            {endpointFields.length > 0 ? (
              <Select
                value={field.apiFieldPath || '__none__'}
                onValueChange={(value) => onChange({
                  ...field,
                  apiFieldPath: value === '__none__' ? undefined : value,
                  fieldName: value !== '__none__' && !field.fieldName
                    ? endpointFields.find(f => f.field_path === value)?.field_name || field.fieldName
                    : field.fieldName
                })}
                options={[
                  { value: '__none__', label: 'Manual entry' },
                  ...endpointFields.map(f => ({
                    value: f.field_path,
                    label: `${f.field_name} (${f.field_path})`
                  }))
                ]}
                searchable
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                No API spec endpoint selected. Select an endpoint in API Configuration to see available fields.
              </p>
            )}
          </div>

          {field.parameterType === 'query' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Operator
              </label>
              <select
                value={field.operator || 'eq'}
                onChange={(e) => onChange({ ...field, operator: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              >
                <option value="eq">eq (equals)</option>
                <option value="ne">ne (not equal)</option>
                <option value="gt">gt (greater than)</option>
                <option value="ge">ge (greater or equal)</option>
                <option value="lt">lt (less than)</option>
                <option value="le">le (less or equal)</option>
                <option value="in">in (in list)</option>
                <option value="not in">not in</option>
                <option value="contains">contains</option>
                <option value="startswith">startswith</option>
                <option value="endswith">endswith</option>
                <option value="not endswith">not endswith</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Value Type *
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={field.valueType === 'static'}
                  onChange={() => onChange({ ...field, valueType: 'static', dynamicValue: undefined })}
                  className="text-blue-600 focus:ring-blue-500 mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Static Value</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={field.valueType === 'dynamic'}
                  onChange={() => onChange({ ...field, valueType: 'dynamic', staticValue: undefined })}
                  className="text-blue-600 focus:ring-blue-500 mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Dynamic Value</span>
              </label>
            </div>
          </div>

          {field.valueType === 'static' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Static Value *
              </label>
              <input
                type="text"
                value={field.staticValue || ''}
                onChange={(e) => onChange({ ...field, staticValue: e.target.value })}
                placeholder="Enter the hardcoded value"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {field.valueType === 'dynamic' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Dynamic Value *
              </label>
              <Select
                value={field.dynamicValue || '__none__'}
                onValueChange={(value) => onChange({ ...field, dynamicValue: value === '__none__' ? undefined : value })}
                options={[
                  { value: '__none__', label: 'Select a dynamic value...' },
                  ...dynamicValueOptions
                ]}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Dynamic values are resolved at runtime based on the logged-in user's context.
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={
              !field.fieldName.trim() ||
              (field.valueType === 'static' && !field.staticValue?.trim()) ||
              (field.valueType === 'dynamic' && !field.dynamicValue) ||
              saving
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Default Field'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface FilterPresetEditModalProps {
  preset: TrackTraceFilterPreset;
  onChange: (preset: TrackTraceFilterPreset) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  filterFields: TrackTraceTemplateField[];
  defaultFields: TrackTraceFilterPresetDefaultField[];
  onDefaultFieldsChange: (fields: TrackTraceFilterPresetDefaultField[]) => void;
}

function FilterPresetEditModal({ preset, onChange, onSave, onClose, saving, filterFields, defaultFields, onDefaultFieldsChange }: FilterPresetEditModalProps) {
  const handleFilterValueChange = (id: string, updates: Partial<TrackTraceFilterValue>) => {
    const newFilterValues = preset.filterValues.map(fv =>
      fv.id === id ? { ...fv, ...updates } : fv
    );
    onChange({ ...preset, filterValues: newFilterValues });
  };

  const handleRemoveFilterValue = (id: string) => {
    const newFilterValues = preset.filterValues.filter(fv => fv.id !== id);
    onChange({ ...preset, filterValues: newFilterValues });
  };

  const handleAddFilterValue = () => {
    const newFilterValue: TrackTraceFilterValue = {
      id: crypto.randomUUID(),
      fieldName: '',
      operator: 'eq',
      value: ''
    };
    onChange({ ...preset, filterValues: [...preset.filterValues, newFilterValue] });
  };

  const getFieldByName = (fieldName: string) => {
    return filterFields.find(f => f.fieldName === fieldName);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {preset.id ? 'Edit' : 'Add'} Quick Filter Button
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure a preset filter that customers can apply with one click.
          </p>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Button Name *
            </label>
            <input
              type="text"
              value={preset.name}
              onChange={(e) => onChange({ ...preset, name: e.target.value })}
              placeholder="e.g., In Transit, Delivered, Exceptions"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Display Order
            </label>
            <input
              type="number"
              value={preset.displayOrder}
              onChange={(e) => onChange({ ...preset, displayOrder: parseInt(e.target.value) || 0 })}
              min={0}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Lower numbers appear first (left to right)
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Filter Values
              </label>
              {filterFields.length > 0 && (
                <button
                  onClick={handleAddFilterValue}
                  className="flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Filter Value
                </button>
              )}
            </div>

            {filterFields.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                No filter fields configured. Add filter fields first to set preset values.
              </p>
            ) : preset.filterValues.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                No filter values configured. Click "Add Filter Value" to add filters.
              </p>
            ) : (
              <div className="space-y-3">
                {preset.filterValues.map(filterValue => {
                  const field = getFieldByName(filterValue.fieldName);

                  return (
                    <div key={filterValue.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Field
                        </label>
                        <button
                          onClick={() => handleRemoveFilterValue(filterValue.id)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          title="Remove this filter"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={filterValue.fieldName}
                        onChange={(e) => handleFilterValueChange(filterValue.id, { fieldName: e.target.value })}
                        placeholder="Enter field name (e.g., traceNumber)"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Operator
                          </label>
                          <select
                            value={filterValue.operator}
                            onChange={(e) => handleFilterValueChange(filterValue.id, { operator: e.target.value })}
                            className="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="eq">eq (equals)</option>
                            <option value="ne">ne (not equal)</option>
                            <option value="gt">gt (greater than)</option>
                            <option value="ge">ge (greater or equal)</option>
                            <option value="lt">lt (less than)</option>
                            <option value="le">le (less or equal)</option>
                            <option value="in">in (in list)</option>
                            <option value="not in">not in</option>
                            <option value="contains">contains</option>
                            <option value="startswith">startswith</option>
                            <option value="endswith">endswith</option>
                            <option value="not endswith">not endswith</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Value
                          </label>
                          <input
                            type={field && field.dataType === 'number' ? 'number' : 'text'}
                            value={filterValue.value}
                            onChange={(e) => handleFilterValueChange(filterValue.id, { value: e.target.value })}
                            placeholder={filterValue.operator === 'in' || filterValue.operator === 'not in' ? "e.g., 'AVAIL','ASSGN'" : `Value for ${filterValue.fieldName}`}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center pt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={preset.isActive}
                onChange={(e) => onChange({ ...preset, isActive: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Active (visible to customers)</span>
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!preset.name.trim() || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Quick Filter'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface DeleteConfirmModalProps {
  type: 'template' | 'field' | 'defaultField' | 'filterPreset';
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  saving: boolean;
}

function DeleteConfirmModal({ type, name, onConfirm, onCancel, saving }: DeleteConfirmModalProps) {
  const getTitle = () => {
    switch (type) {
      case 'template': return 'Delete Template';
      case 'field': return 'Delete Field';
      case 'defaultField': return 'Delete Default Field';
      case 'filterPreset': return 'Delete Quick Filter';
    }
  };

  const getMessage = () => {
    switch (type) {
      case 'template':
        return `Are you sure you want to delete the template "${name}"? This will also delete all associated filter fields, result columns, and default fields. This action cannot be undone.`;
      case 'field':
        return `Are you sure you want to delete the field "${name}"? This action cannot be undone.`;
      case 'defaultField':
        return `Are you sure you want to delete the default field "${name}"? This action cannot be undone.`;
      case 'filterPreset':
        return `Are you sure you want to delete the quick filter button "${name}"? This action cannot be undone.`;
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {getTitle()}
            </h3>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {getMessage()}
          </p>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface TrackTracePreviewModalProps {
  template: TrackTraceTemplate;
  filterFields: TrackTraceTemplateField[];
  selectFields: TrackTraceTemplateField[];
  defaultFields: TrackTraceTemplateDefaultField[];
  filterPresets: TrackTraceFilterPreset[];
  secondaryApis: SecondaryApiConfig[];
  onClose: () => void;
}

function TrackTracePreviewModal({
  template,
  filterFields,
  selectFields,
  defaultFields,
  filterPresets,
  secondaryApis,
  onClose
}: TrackTracePreviewModalProps) {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dynamicTestValues, setDynamicTestValues] = useState<Record<string, string>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<any[] | null>(null);
  const [lastRequestUrl, setLastRequestUrl] = useState<string | null>(null);
  const [apiSettings, setApiSettings] = useState<{ path: string; password: string } | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activePresetFilterValues, setActivePresetFilterValues] = useState<TrackTraceFilterPreset['filterValues'] | null>(null);

  useEffect(() => {
    loadApiSettings();
  }, []);

  const loadApiSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('api_settings')
        .select('path, password')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setApiSettings(data);
      }
    } catch (err) {
      console.error('Failed to load API settings:', err);
    }
  };

  const getApiBaseUrl = (): string => {
    if (template.apiSourceType === 'secondary' && template.secondaryApiId) {
      const secondaryApi = secondaryApis.find(a => a.id === template.secondaryApiId);
      return secondaryApi?.baseUrl || '';
    }
    return apiSettings?.path || '';
  };

  const getAuthToken = (): string => {
    if (template.apiSourceType === 'secondary' && template.secondaryApiId) {
      const secondaryApi = secondaryApis.find(a => a.id === template.secondaryApiId);
      return secondaryApi?.authToken || '';
    }
    return apiSettings?.password || '';
  };

  const buildODataFilterFromPreset = (presetFilterValues: TrackTraceFilterPreset['filterValues']): string => {
    const filterParts: string[] = [];

    presetFilterValues.forEach(filterValue => {
      if (!filterValue.value) return;

      const { fieldName, operator, value } = filterValue;
      let filterStr = '';

      if (operator === 'in' || operator === 'not in') {
        const values = String(value).split(',').map(v => {
          const trimmed = v.trim();
          return trimmed.startsWith("'") ? trimmed : `'${trimmed.replace(/'/g, "''")}'`;
        });
        if (operator === 'in') {
          filterStr = `${fieldName} in (${values.join(',')})`;
        } else {
          filterStr = `(${values.map(v => `${fieldName} ne ${v}`).join(' and ')})`;
        }
      } else if (operator === 'contains' || operator === 'startswith' || operator === 'endswith') {
        const escapedValue = String(value).replace(/'/g, "''");
        filterStr = `${operator}(${fieldName},'${escapedValue}')`;
      } else if (operator === 'not endswith') {
        const escapedValue = String(value).replace(/'/g, "''");
        filterStr = `not endswith(${fieldName},'${escapedValue}')`;
      } else {
        const isNumeric = !isNaN(Number(value)) && value.toString().trim() !== '';
        if (isNumeric) {
          filterStr = `${fieldName} ${operator} ${value}`;
        } else {
          const escapedValue = String(value).replace(/'/g, "''");
          filterStr = `${fieldName} ${operator} '${escapedValue}'`;
        }
      }

      if (filterStr) {
        filterParts.push(filterStr);
      }
    });

    return filterParts.join(' and ');
  };

  const buildODataFilter = (usePreset: boolean = false): string => {
    const filterParts: string[] = [];

    if (usePreset && activePresetFilterValues && activePresetFilterValues.length > 0) {
      const presetFilter = buildODataFilterFromPreset(activePresetFilterValues);
      if (presetFilter) {
        filterParts.push(presetFilter);
      }
    } else {
      filterFields.filter(f => f.isEnabled && f.parameterType === '$filter').forEach(field => {
        const value = filterValues[field.id];
        if (!value) return;

        const fieldName = field.apiFieldPath || field.fieldName;
        const operator = field.filterOperator || 'eq';

        let filterExpr = '';
        if (operator === 'contains' || operator === 'startswith' || operator === 'endswith') {
          filterExpr = `${operator}(${fieldName}, '${value}')`;
        } else {
          const formattedValue = field.dataType === 'string' ? `'${value}'` : value;
          filterExpr = `${fieldName} ${operator} ${formattedValue}`;
        }
        filterParts.push(filterExpr);
      });
    }

    defaultFields.filter(f => f.parameterType === 'query').forEach(field => {
      let value: string;
      if (field.valueType === 'static') {
        value = field.staticValue || '';
      } else {
        value = dynamicTestValues[field.fieldName] || `{${field.dynamicValue || field.fieldName}}`;
      }
      if (!value) return;
      const rawFieldName = field.apiFieldPath || field.fieldName;
      let fieldName = rawFieldName.replace(/^\[.*?\]\s*/, '');
      if (fieldName === '$filter') {
        fieldName = field.fieldName;
      }
      const operator = field.operator || 'eq';
      let filterExpr = '';
      if (operator === 'contains' || operator === 'startswith' || operator === 'endswith') {
        filterExpr = `${operator}(${fieldName}, '${value}')`;
      } else if (operator === 'not contains') {
        filterExpr = `not contains(${fieldName}, '${value}')`;
      } else if (operator === 'not startswith') {
        filterExpr = `not startswith(${fieldName}, '${value}')`;
      } else if (operator === 'not endswith') {
        filterExpr = `not endswith(${fieldName}, '${value}')`;
      } else {
        filterExpr = `${fieldName} ${operator} '${value}'`;
      }
      filterParts.push(filterExpr);
    });

    return filterParts.join(' and ');
  };

  const buildCurrentPreviewUrl = (presetFilterValues?: TrackTraceFilterPreset['filterValues']): string => {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return '';

    const apiPath = template.apiPath.startsWith('/') ? template.apiPath : '/' + template.apiPath;
    let url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) + apiPath : baseUrl + apiPath;

    const queryParams: string[] = [];

    const filterParts: string[] = [];
    if (presetFilterValues && Object.keys(presetFilterValues).length > 0) {
      const presetFilter = buildODataFilterFromPreset(presetFilterValues);
      if (presetFilter) {
        filterParts.push(presetFilter);
      }
    } else {
      filterFields.filter(f => f.isEnabled && f.parameterType === '$filter').forEach(field => {
        const value = filterValues[field.id];
        if (!value) return;
        const rawFieldName = field.apiFieldPath || field.fieldName;
        let fieldName = rawFieldName.replace(/^\[.*?\]\s*/, '');
        if (fieldName === '$filter') {
          fieldName = field.fieldName;
        }
        const operator = field.filterOperator || 'eq';
        let filterExpr = '';
        if (operator === 'contains' || operator === 'startswith' || operator === 'endswith') {
          filterExpr = `${operator}(${fieldName}, '${value}')`;
        } else {
          const formattedValue = field.dataType === 'string' ? `'${value}'` : value;
          filterExpr = `${fieldName} ${operator} ${formattedValue}`;
        }
        filterParts.push(filterExpr);
      });
    }

    defaultFields.filter(f => f.parameterType === 'query').forEach(field => {
      let value: string;
      if (field.valueType === 'static') {
        value = field.staticValue || '';
      } else {
        value = dynamicTestValues[field.fieldName] || `{${field.dynamicValue || field.fieldName}}`;
      }
      if (!value) return;
      const rawFieldName = field.apiFieldPath || field.fieldName;
      let fieldName = rawFieldName.replace(/^\[.*?\]\s*/, '');
      if (fieldName === '$filter') {
        fieldName = field.fieldName;
      }
      const operator = field.operator || 'eq';
      let filterExpr = '';
      if (operator === 'contains' || operator === 'startswith' || operator === 'endswith') {
        filterExpr = `${operator}(${fieldName}, '${value}')`;
      } else if (operator === 'not contains') {
        filterExpr = `not contains(${fieldName}, '${value}')`;
      } else if (operator === 'not startswith') {
        filterExpr = `not startswith(${fieldName}, '${value}')`;
      } else if (operator === 'not endswith') {
        filterExpr = `not endswith(${fieldName}, '${value}')`;
      } else {
        filterExpr = `${fieldName} ${operator} '${value}'`;
      }
      filterParts.push(filterExpr);
    });

    if (filterParts.length > 0) {
      queryParams.push(`$filter=${filterParts.join(' and ')}`);
    }

    const selectParam = buildSelectFields();
    if (selectParam) {
      queryParams.push(`$select=${selectParam}`);
    }

    if (template.defaultLimit) {
      queryParams.push(`$limit=${template.defaultLimit}`);
    }

    if (template.defaultOrderBy) {
      queryParams.push(`$orderby=${template.defaultOrderBy} ${template.defaultOrderDirection || 'desc'}`);
    }

    filterFields.filter(f => f.isEnabled && f.parameterType === 'query').forEach(field => {
      const value = filterValues[field.id];
      if (value) {
        queryParams.push(`${field.fieldName}=${encodeURIComponent(value)}`);
      }
    });

    if (queryParams.length > 0) {
      url += (url.includes('?') ? '&' : '?') + queryParams.join('&');
    }

    return url;
  };

  const buildSelectFields = (): string => {
    const selectFieldNames = selectFields
      .filter(f => f.isEnabled)
      .map(f => f.apiFieldPath || f.fieldName);
    return selectFieldNames.join(',');
  };

  const handleSearch = async (usePreset: boolean = false) => {
    setIsSearching(true);
    setSearchError(null);
    setResults(null);

    try {
      const baseUrl = getApiBaseUrl();
      if (!baseUrl) {
        throw new Error('API base URL not configured');
      }

      const authToken = getAuthToken();

      const apiPath = template.apiPath.startsWith('/') ? template.apiPath : '/' + template.apiPath;
      let url = baseUrl.endsWith('/')
        ? baseUrl.slice(0, -1) + apiPath
        : baseUrl + apiPath;

      const queryParams: string[] = [];

      const oDataFilter = buildODataFilter(usePreset);
      if (oDataFilter) {
        queryParams.push(`$filter=${oDataFilter}`);
      }

      const selectParam = buildSelectFields();
      if (selectParam) {
        queryParams.push(`$select=${selectParam}`);
      }

      if (template.defaultLimit) {
        queryParams.push(`$limit=${template.defaultLimit}`);
      }

      if (template.defaultOrderBy) {
        queryParams.push(`$orderby=${template.defaultOrderBy} ${template.defaultOrderDirection || 'desc'}`);
      }

      filterFields.filter(f => f.isEnabled && f.parameterType === 'query').forEach(field => {
        const value = filterValues[field.id];
        if (value) {
          queryParams.push(`${field.fieldName}=${encodeURIComponent(value)}`);
        }
      });

      if (queryParams.length > 0) {
        url += (url.includes('?') ? '&' : '?') + queryParams.join('&');
      }

      setLastRequestUrl(url);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(url, {
        method: template.httpMethod || 'GET',
        headers
      });

      if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
        } catch {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      let resultsArray: any[] = [];
      if (Array.isArray(data)) {
        resultsArray = data;
      } else if (data.value && Array.isArray(data.value)) {
        resultsArray = data.value;
      } else if (data.data && Array.isArray(data.data)) {
        resultsArray = data.data;
      } else if (data.results && Array.isArray(data.results)) {
        resultsArray = data.results;
      } else {
        const arrayProp = Object.keys(data).find(key => Array.isArray(data[key]));
        if (arrayProp) {
          resultsArray = data[arrayProp];
        } else {
          resultsArray = [data];
        }
      }

      setResults(resultsArray);
    } catch (err: any) {
      setSearchError(err.message || 'Failed to execute search');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClear = () => {
    setFilterValues({});
    setDynamicTestValues({});
    setResults(null);
    setSearchError(null);
    setActivePresetId(null);
    setActivePresetFilterValues(null);
    setLastRequestUrl(null);
  };

  const handlePresetClick = (preset: TrackTraceFilterPreset) => {
    setActivePresetId(preset.id);
    setActivePresetFilterValues(preset.filterValues);
    setFilterValues({});
    const url = buildCurrentPreviewUrl(preset.filterValues);
    setLastRequestUrl(url);
    handleSearchWithPreset(preset.filterValues);
  };

  const handleSearchWithPreset = async (presetFilterValues: TrackTraceFilterPreset['filterValues']) => {
    setIsSearching(true);
    setSearchError(null);
    setResults(null);

    try {
      const baseUrl = getApiBaseUrl();
      if (!baseUrl) {
        throw new Error('API base URL not configured');
      }

      const authToken = getAuthToken();
      const url = buildCurrentPreviewUrl(presetFilterValues);
      setLastRequestUrl(url);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(url, {
        method: template.httpMethod || 'GET',
        headers
      });

      if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
        } catch {
          const errorText = await response.text();
          if (errorText) errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      let resultsArray: any[] = [];
      if (Array.isArray(data)) {
        resultsArray = data;
      } else if (data.value && Array.isArray(data.value)) {
        resultsArray = data.value;
      } else if (data.data && Array.isArray(data.data)) {
        resultsArray = data.data;
      } else if (data.results && Array.isArray(data.results)) {
        resultsArray = data.results;
      } else {
        const arrayProp = Object.keys(data).find(key => Array.isArray(data[key]));
        if (arrayProp) {
          resultsArray = data[arrayProp];
        } else {
          resultsArray = [data];
        }
      }

      setResults(resultsArray);
    } catch (err: any) {
      setSearchError(err.message || 'Failed to execute search');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFilterValueChange = (fieldId: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [fieldId]: value }));
    setActivePresetId(null);
    setActivePresetFilterValues(null);
  };

  const getFieldValue = (record: any, fieldName: string): string => {
    if (fieldName.includes('.')) {
      const parts = fieldName.split('.');
      let value = record;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          return 'N/A';
        }
      }
      return value !== null && value !== undefined ? String(value) : 'N/A';
    }
    const value = record[fieldName];
    return value !== null && value !== undefined ? String(value) : 'N/A';
  };

  const enabledFilterFields = filterFields.filter(f => f.isEnabled);
  const enabledSelectFields = selectFields.filter(f => f.isEnabled);

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Test Template: {template.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Enter filter values and click Search to test the API response
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {filterPresets.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                Quick Filters
              </h4>
              <div className="flex flex-wrap gap-2">
                {filterPresets.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset)}
                    disabled={isSearching}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      activePresetId === preset.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {enabledFilterFields.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                Filter Fields
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {enabledFilterFields.map(field => (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {field.displayLabel}
                      {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                      <span className="text-xs text-gray-500 ml-2">({field.filterOperator})</span>
                    </label>
                    {field.dataType === 'boolean' ? (
                      <select
                        value={filterValues[field.id] || ''}
                        onChange={(e) => handleFilterValueChange(field.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : field.dataType === 'date' ? (
                      <input
                        type="date"
                        value={filterValues[field.id] || ''}
                        onChange={(e) => handleFilterValueChange(field.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    ) : (
                      <input
                        type={field.dataType === 'number' ? 'number' : 'text'}
                        value={filterValues[field.id] || ''}
                        onChange={(e) => handleFilterValueChange(field.id, e.target.value)}
                        placeholder={`Enter ${field.displayLabel.toLowerCase()}...`}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {defaultFields.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <Lock className="h-4 w-4 mr-2" />
                Default Fields (sent automatically)
              </h4>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="space-y-3">
                  {defaultFields.map(field => (
                    <div key={field.id} className="flex items-center justify-between text-sm gap-4">
                      <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">{field.fieldName}</span>
                      {field.valueType === 'static' ? (
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {field.staticValue}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <input
                            type="text"
                            value={dynamicTestValues[field.fieldName] || ''}
                            onChange={(e) => setDynamicTestValues(prev => ({
                              ...prev,
                              [field.fieldName]: e.target.value
                            }))}
                            placeholder={`Enter test value...`}
                            className="w-48 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                          <span className="text-blue-600 dark:text-blue-400 italic text-xs whitespace-nowrap">
                            {field.dynamicValue}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3">
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
          </div>

          {lastRequestUrl && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center">
                <ExternalLink className="h-3 w-3 mr-1" />
                Request URL
              </h5>
              <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all select-all">
                {lastRequestUrl}
              </p>
            </div>
          )}

          {searchError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
                <div>
                  <h5 className="font-medium text-red-800 dark:text-red-300">Search Failed</h5>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">{searchError}</p>
                </div>
              </div>
            </div>
          )}

          {results !== null && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <Columns className="h-4 w-4 mr-2" />
                Results ({results.length} records)
              </h4>

              {results.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">No records found matching your search criteria</p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          {enabledSelectFields.map(field => (
                            <th
                              key={field.id}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                            >
                              {field.displayLabel}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {results.slice(0, 50).map((record, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            {enabledSelectFields.map(field => (
                              <td key={field.id} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {getFieldValue(record, field.apiFieldPath || field.fieldName)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {results.length > 50 && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
                      Showing first 50 of {results.length} results
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
