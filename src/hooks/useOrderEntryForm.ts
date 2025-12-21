import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { OrderEntryConfig, OrderEntryFieldGroup, OrderEntryField, OrderEntryFieldLayout } from '../types';

interface UseOrderEntryFormOptions {
  clientId?: string;
}

export function useOrderEntryForm(options: UseOrderEntryFormOptions = {}) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<OrderEntryConfig | null>(null);
  const [fieldGroups, setFieldGroups] = useState<OrderEntryFieldGroup[]>([]);
  const [fields, setFields] = useState<OrderEntryField[]>([]);
  const [layouts, setLayouts] = useState<OrderEntryFieldLayout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);

  useEffect(() => {
    loadFormConfiguration();
  }, [options.clientId]);

  const loadFormConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);

      let assignedTemplateId: string | null = null;

      if (options.clientId) {
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('order_entry_template_id')
          .eq('id', options.clientId)
          .maybeSingle();

        if (clientError) throw clientError;
        assignedTemplateId = clientData?.order_entry_template_id || null;
      }

      if (assignedTemplateId) {
        await loadFromTemplate(assignedTemplateId);
      } else {
        await loadFromGlobalConfig();
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load form configuration');
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFromTemplate = async (templateIdParam: string) => {
    const { data: templateData, error: templateError } = await supabase
      .from('order_entry_templates')
      .select('*')
      .eq('id', templateIdParam)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError) throw templateError;

    if (!templateData) {
      await loadFromGlobalConfig();
      return;
    }

    setTemplateId(templateData.id);
    setTemplateName(templateData.name);

    const [groupsRes, fieldsRes, layoutsRes, configRes] = await Promise.all([
      supabase
        .from('order_entry_template_field_groups')
        .select('*')
        .eq('template_id', templateIdParam)
        .order('group_order', { ascending: true }),
      supabase
        .from('order_entry_template_fields')
        .select('*')
        .eq('template_id', templateIdParam)
        .order('field_order', { ascending: true }),
      supabase
        .from('order_entry_template_field_layout')
        .select('*')
        .eq('template_id', templateIdParam),
      supabase.from('order_entry_config').select('*').maybeSingle()
    ]);

    if (groupsRes.error) throw groupsRes.error;
    if (fieldsRes.error) throw fieldsRes.error;
    if (layoutsRes.error) throw layoutsRes.error;
    if (configRes.error) throw configRes.error;

    const transformedConfig = configRes.data ? {
      id: configRes.data.id,
      apiEndpoint: configRes.data.api_endpoint,
      apiMethod: configRes.data.api_method,
      apiHeaders: configRes.data.api_headers,
      apiAuthType: configRes.data.api_auth_type,
      apiAuthToken: configRes.data.api_auth_token,
      workflowId: templateData.workflow_id || configRes.data.workflow_id,
      isEnabled: configRes.data.is_enabled,
      createdAt: configRes.data.created_at,
      updatedAt: configRes.data.updated_at
    } : null;

    const transformedGroups = (groupsRes.data || []).map((g: any) => ({
      id: g.id,
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
      createdAt: g.created_at,
      updatedAt: g.updated_at
    }));

    const transformedFields = (fieldsRes.data || []).map((f: any) => ({
      id: f.id,
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
      dropdownOptions: typeof f.dropdown_options === 'string' ? JSON.parse(f.dropdown_options) : (f.dropdown_options || []),
      jsonPath: f.json_path,
      isArrayField: f.is_array_field,
      arrayMinRows: f.array_min_rows,
      arrayMaxRows: f.array_max_rows,
      aiExtractionInstructions: f.ai_extraction_instructions,
      validationRegex: f.validation_regex,
      validationErrorMessage: f.validation_error_message,
      fieldOrder: f.field_order,
      createdAt: f.created_at,
      updatedAt: f.updated_at
    }));

    const transformedLayouts = (layoutsRes.data || []).map((l: any) => ({
      id: l.id,
      fieldId: l.field_id,
      rowIndex: l.row_index,
      columnIndex: l.column_index,
      widthColumns: l.width_columns,
      mobileWidthColumns: l.mobile_width_columns,
      createdAt: l.created_at,
      updatedAt: l.updated_at
    }));

    setConfig(transformedConfig);
    setFieldGroups(transformedGroups);
    setFields(transformedFields);
    setLayouts(transformedLayouts);

    if (!transformedConfig?.isEnabled) {
      setError('Order entry is currently disabled. Please contact your administrator.');
    }
  };

  const loadFromGlobalConfig = async () => {
    setTemplateId(null);
    setTemplateName(null);

    const [configRes, groupsRes, fieldsRes, layoutsRes] = await Promise.all([
      supabase.from('order_entry_config').select('*').maybeSingle(),
      supabase.from('order_entry_field_groups').select('*').order('group_order', { ascending: true }),
      supabase.from('order_entry_fields').select('*').order('field_order', { ascending: true }),
      supabase.from('order_entry_field_layout').select('*')
    ]);

    if (configRes.error) throw configRes.error;
    if (groupsRes.error) throw groupsRes.error;
    if (fieldsRes.error) throw fieldsRes.error;
    if (layoutsRes.error) throw layoutsRes.error;

    const transformedConfig = configRes.data ? {
      id: configRes.data.id,
      apiEndpoint: configRes.data.api_endpoint,
      apiMethod: configRes.data.api_method,
      apiHeaders: configRes.data.api_headers,
      apiAuthType: configRes.data.api_auth_type,
      apiAuthToken: configRes.data.api_auth_token,
      workflowId: configRes.data.workflow_id,
      isEnabled: configRes.data.is_enabled,
      createdAt: configRes.data.created_at,
      updatedAt: configRes.data.updated_at
    } : null;

    const transformedGroups = (groupsRes.data || []).map((g: any) => ({
      id: g.id,
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
      createdAt: g.created_at,
      updatedAt: g.updated_at
    }));

    const transformedFields = (fieldsRes.data || []).map((f: any) => ({
      id: f.id,
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
      dropdownOptions: typeof f.dropdown_options === 'string' ? JSON.parse(f.dropdown_options) : (f.dropdown_options || []),
      jsonPath: f.json_path,
      isArrayField: f.is_array_field,
      arrayMinRows: f.array_min_rows,
      arrayMaxRows: f.array_max_rows,
      aiExtractionInstructions: f.ai_extraction_instructions,
      validationRegex: f.validation_regex,
      validationErrorMessage: f.validation_error_message,
      fieldOrder: f.field_order,
      createdAt: f.created_at,
      updatedAt: f.updated_at
    }));

    const transformedLayouts = (layoutsRes.data || []).map((l: any) => ({
      id: l.id,
      fieldId: l.field_id,
      rowIndex: l.row_index,
      columnIndex: l.column_index,
      widthColumns: l.width_columns,
      mobileWidthColumns: l.mobile_width_columns,
      createdAt: l.created_at,
      updatedAt: l.updated_at
    }));

    setConfig(transformedConfig);
    setFieldGroups(transformedGroups);
    setFields(transformedFields);
    setLayouts(transformedLayouts);

    if (!transformedConfig?.isEnabled) {
      setError('Order entry is currently disabled. Please contact your administrator.');
    }
  };

  return {
    loading,
    config,
    fieldGroups,
    fields,
    layouts,
    error,
    templateId,
    templateName,
    reload: loadFormConfiguration
  };
}
