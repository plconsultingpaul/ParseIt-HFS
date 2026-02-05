import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import FlowExecutionModal, { ExecuteButtonGroup, ExecuteButtonField, FlowNodeMapping } from './common/FlowExecutionModal';

interface ExecuteButton {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export default function PublicExecutePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [button, setButton] = useState<ExecuteButton | null>(null);
  const [groups, setGroups] = useState<ExecuteButtonGroup[]>([]);
  const [fields, setFields] = useState<ExecuteButtonField[]>([]);
  const [flowNodeMappings, setFlowNodeMappings] = useState<FlowNodeMapping[]>([]);
  const [showExecution, setShowExecution] = useState(false);

  useEffect(() => {
    if (slug) {
      loadButtonData();
    }
  }, [slug]);

  const loadButtonData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: buttonData, error: buttonError } = await supabase
        .from('execute_buttons')
        .select('id, name, description, is_active')
        .eq('qr_code_slug', slug)
        .eq('qr_code_enabled', true)
        .maybeSingle();

      if (buttonError) throw buttonError;

      if (!buttonData) {
        setError('This QR code link is not valid or has been disabled.');
        return;
      }

      if (!buttonData.is_active) {
        setError('This flow is currently inactive.');
        return;
      }

      setButton({
        id: buttonData.id,
        name: buttonData.name,
        description: buttonData.description,
        isActive: buttonData.is_active
      });

      const [groupsRes, fieldsRes, flowRes] = await Promise.all([
        supabase
          .from('execute_button_groups')
          .select('*')
          .eq('button_id', buttonData.id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('execute_button_fields')
          .select('*')
          .order('sort_order', { ascending: true }),
        supabase
          .from('execute_button_flow_nodes')
          .select('*')
          .eq('button_id', buttonData.id)
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (fieldsRes.error) throw fieldsRes.error;

      const groupIds = (groupsRes.data || []).map(g => g.id);
      const buttonFields = (fieldsRes.data || []).filter(f => groupIds.includes(f.group_id));

      const mappedGroups: ExecuteButtonGroup[] = (groupsRes.data || []).map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        sortOrder: g.sort_order,
        isArrayGroup: g.is_array_group || false,
        arrayMinRows: g.array_min_rows || 1,
        arrayMaxRows: g.array_max_rows || 10,
        arrayFieldName: g.array_field_name || ''
      }));

      const mappedFields: ExecuteButtonField[] = buttonFields.map(f => ({
        id: f.id,
        groupId: f.group_id,
        name: f.name,
        fieldKey: f.field_key,
        fieldType: f.field_type,
        isRequired: f.is_required,
        defaultValue: f.default_value,
        options: f.options,
        dropdownDisplayMode: f.dropdown_display_mode,
        sortOrder: f.sort_order,
        placeholder: f.placeholder,
        helpText: f.help_text,
        maxLength: f.max_length
      }));

      const mappings: FlowNodeMapping[] = (flowRes.data || [])
        .filter((n: any) => n.node_type === 'form_group')
        .map((n: any) => ({
          nodeId: n.id,
          groupId: n.group_id,
          fieldMappings: n.field_mappings || {},
          headerContent: n.header_content,
          displayWithPrevious: n.display_with_previous || false
        }));

      setGroups(mappedGroups);
      setFields(mappedFields);
      setFlowNodeMappings(mappings);
      setShowExecution(true);
    } catch (err: any) {
      console.error('Error loading button data:', err);
      setError('Failed to load this flow. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowExecution(false);
    setButton(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Unable to Load Flow
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (showExecution && button) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <FlowExecutionModal
          buttonId={button.id}
          buttonName={button.name}
          groups={groups}
          fields={fields}
          flowNodeMappings={flowNodeMappings}
          onClose={handleClose}
          title={button.name}
        />
      </div>
    );
  }

  return null;
}
