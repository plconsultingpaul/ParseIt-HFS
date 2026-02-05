import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Play, Loader2, AlertCircle, Check, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TextField, NumberField, DateField, DateTimeField, TimeField, PhoneField, ZipField, PostalCodeField, ProvinceField, StateField, DropdownField } from './form-fields';

interface ExecuteButton {
  id: string;
  name: string;
  description: string | null;
}

interface ExecuteButtonGroup {
  id: string;
  buttonId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isArrayGroup: boolean;
  arrayMinRows: number;
  arrayMaxRows: number;
  arrayFieldName: string;
}

interface ExecuteButtonField {
  id: string;
  groupId: string;
  name: string;
  fieldKey: string;
  fieldType: string;
  isRequired: boolean;
  defaultValue: string | null;
  options: any[];
  dropdownDisplayMode: 'description_only' | 'value_and_description';
  sortOrder: number;
  placeholder: string | null;
  helpText: string | null;
  maxLength: number | null;
}

interface ExecuteModalProps {
  button: ExecuteButton;
  onClose: () => void;
  onExecute: (parameters: Record<string, any>) => void;
}

interface FlowNodeInfo {
  groupId: string;
  displayWithPrevious: boolean;
}

export default function ExecuteModal({ button, onClose, onExecute }: ExecuteModalProps) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ExecuteButtonGroup[]>([]);
  const [fields, setFields] = useState<ExecuteButtonField[]>([]);
  const [flowNodeInfo, setFlowNodeInfo] = useState<FlowNodeInfo[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [arrayData, setArrayData] = useState<Record<string, Record<string, any>[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    loadButtonData();
  }, [button.id]);

  const loadButtonData = async () => {
    try {
      setLoading(true);

      const [groupsRes, fieldsRes, flowNodesRes] = await Promise.all([
        supabase
          .from('execute_button_groups')
          .select('*')
          .eq('button_id', button.id)
          .order('sort_order', { ascending: true }),
        supabase
          .from('execute_button_fields')
          .select('*')
          .order('sort_order', { ascending: true }),
        supabase
          .from('execute_button_flow_nodes')
          .select('group_id, display_with_previous')
          .eq('button_id', button.id)
          .eq('node_type', 'group')
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (fieldsRes.error) throw fieldsRes.error;

      let allGroups: ExecuteButtonGroup[] = (groupsRes.data || []).map((g: any) => {
        const group = {
          id: g.id,
          buttonId: g.button_id,
          name: g.name,
          description: g.description,
          sortOrder: g.sort_order,
          isArrayGroup: g.is_array_group || false,
          arrayMinRows: g.array_min_rows || 1,
          arrayMaxRows: g.array_max_rows || 10,
          arrayFieldName: g.array_field_name || ''
        };
        console.log('Loading group:', group.name, {
          isArrayGroup: group.isArrayGroup,
          arrayFieldName: group.arrayFieldName,
          raw: { is_array_group: g.is_array_group, array_field_name: g.array_field_name }
        });
        return group;
      });

      let flowGroupIds: string[] | null = null;
      let flowNodeInfoData: FlowNodeInfo[] = [];
      if (flowNodesRes.data && flowNodesRes.data.length > 0) {
        flowGroupIds = flowNodesRes.data
          .filter((n: any) => n.group_id)
          .map((n: any) => n.group_id);
        flowNodeInfoData = flowNodesRes.data
          .filter((n: any) => n.group_id)
          .map((n: any) => ({
            groupId: n.group_id,
            displayWithPrevious: n.display_with_previous || false,
          }));
      }

      const groupsData = flowGroupIds && flowGroupIds.length > 0
        ? allGroups.filter(g => flowGroupIds!.includes(g.id))
        : allGroups;

      setFlowNodeInfo(flowNodeInfoData);

      const groupIds = groupsData.map(g => g.id);
      const fieldsData: ExecuteButtonField[] = (fieldsRes.data || [])
        .filter((f: any) => groupIds.includes(f.group_id))
        .map((f: any) => ({
          id: f.id,
          groupId: f.group_id,
          name: f.name,
          fieldKey: f.field_key,
          fieldType: f.field_type,
          isRequired: f.is_required,
          defaultValue: f.default_value,
          options: f.options || [],
          dropdownDisplayMode: f.dropdown_display_mode || 'description_only',
          sortOrder: f.sort_order,
          placeholder: f.placeholder,
          helpText: f.help_text,
          maxLength: f.max_length
        }));

      setGroups(groupsData);
      setFields(fieldsData);

      const initialData: Record<string, any> = {};
      const initialArrayData: Record<string, Record<string, any>[]> = {};

      groupsData.forEach(group => {
        if (group.isArrayGroup && group.arrayFieldName) {
          const groupFields = fieldsData.filter(f => f.groupId === group.id);
          const initialRows: Record<string, any>[] = [];
          for (let i = 0; i < group.arrayMinRows; i++) {
            const row: Record<string, any> = {};
            groupFields.forEach(field => {
              if (field.defaultValue) {
                row[field.fieldKey] = field.defaultValue;
              } else if (field.fieldType === 'checkbox') {
                row[field.fieldKey] = 'False';
              } else {
                row[field.fieldKey] = '';
              }
            });
            initialRows.push(row);
          }
          initialArrayData[group.arrayFieldName] = initialRows;
        }
      });

      fieldsData.forEach(field => {
        const group = groupsData.find(g => g.id === field.groupId);
        if (group?.isArrayGroup) return;

        if (field.defaultValue) {
          initialData[field.fieldKey] = field.defaultValue;
        } else if (field.fieldType === 'checkbox') {
          initialData[field.fieldKey] = 'False';
        }
      });
      setFormData(initialData);
      setArrayData(initialArrayData);
    } catch (err: any) {
      console.error('Failed to load button data:', err);
    } finally {
      setLoading(false);
    }
  };

  const combinedSteps = useMemo(() => {
    const steps: ExecuteButtonGroup[][] = [];
    groups.forEach((group, index) => {
      const nodeInfo = flowNodeInfo.find(n => n.groupId === group.id);
      const displayWithPrevious = nodeInfo?.displayWithPrevious || false;
      if (index === 0 || !displayWithPrevious) {
        steps.push([group]);
      } else {
        steps[steps.length - 1].push(group);
      }
    });
    return steps;
  }, [groups, flowNodeInfo]);

  const currentStepGroups = combinedSteps[currentStep] || [];
  const totalSteps = combinedSteps.length;
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    currentStepGroups.forEach(group => {
      const groupFields = fields.filter(f => f.groupId === group.id);

      if (group.isArrayGroup && group.arrayFieldName) {
        const rows = arrayData[group.arrayFieldName] || [];
        rows.forEach((row, rowIndex) => {
          groupFields.forEach(field => {
            const value = row[field.fieldKey];
            const errorKey = `${group.arrayFieldName}[${rowIndex}].${field.fieldKey}`;

            if (field.isRequired) {
              if (value === undefined || value === null || value === '') {
                newErrors[errorKey] = `${field.name} is required`;
                return;
              }
            }

            if (field.fieldType === 'email' && value) {
              if (!emailRegex.test(value)) {
                newErrors[errorKey] = 'Please enter a valid email address';
              }
            }
          });
        });
      } else {
        groupFields.forEach(field => {
          const value = formData[field.fieldKey];

          if (field.isRequired) {
            if (value === undefined || value === null || value === '') {
              newErrors[field.fieldKey] = `${field.name} is required`;
              return;
            }
          }

          if (field.fieldType === 'email' && value) {
            if (!emailRegex.test(value)) {
              newErrors[field.fieldKey] = 'Please enter a valid email address';
            }
          }
        });
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleExecute = async () => {
    if (!validateCurrentStep()) return;

    setIsExecuting(true);
    try {
      const combinedData = { ...formData, ...arrayData };
      await onExecute(combinedData);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }));
    if (errors[fieldKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }
  };

  const handleArrayFieldChange = (arrayFieldName: string, rowIndex: number, fieldKey: string, value: any) => {
    setArrayData(prev => {
      const rows = [...(prev[arrayFieldName] || [])];
      if (!rows[rowIndex]) {
        rows[rowIndex] = {};
      }
      rows[rowIndex] = { ...rows[rowIndex], [fieldKey]: value };
      return { ...prev, [arrayFieldName]: rows };
    });
    const errorKey = `${arrayFieldName}[${rowIndex}].${fieldKey}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const handleAddRow = (group: ExecuteButtonGroup) => {
    if (!group.arrayFieldName) return;
    const rows = arrayData[group.arrayFieldName] || [];
    if (rows.length >= group.arrayMaxRows) return;

    const groupFields = fields.filter(f => f.groupId === group.id);
    const newRow: Record<string, any> = {};
    groupFields.forEach(field => {
      if (field.defaultValue) {
        newRow[field.fieldKey] = field.defaultValue;
      } else if (field.fieldType === 'checkbox') {
        newRow[field.fieldKey] = 'False';
      } else {
        newRow[field.fieldKey] = '';
      }
    });

    setArrayData(prev => ({
      ...prev,
      [group.arrayFieldName]: [...rows, newRow]
    }));
  };

  const handleRemoveRow = (group: ExecuteButtonGroup, rowIndex: number) => {
    if (!group.arrayFieldName) return;
    const rows = arrayData[group.arrayFieldName] || [];
    if (rows.length <= group.arrayMinRows) return;

    setArrayData(prev => ({
      ...prev,
      [group.arrayFieldName]: rows.filter((_, i) => i !== rowIndex)
    }));
  };

  const renderField = (buttonField: ExecuteButtonField) => {
    const value = formData[buttonField.fieldKey] ?? '';
    const error = errors[buttonField.fieldKey];

    const fieldObj = {
      id: buttonField.id,
      fieldLabel: buttonField.name,
      fieldType: buttonField.fieldType,
      isRequired: buttonField.isRequired,
      placeholder: buttonField.placeholder || '',
      helpText: buttonField.helpText || '',
      maxLength: buttonField.maxLength || 0,
      dropdownOptions: buttonField.options,
      dropdownDisplayMode: buttonField.dropdownDisplayMode
    };

    const commonProps = {
      field: fieldObj,
      value,
      onChange: (val: any) => handleFieldChange(buttonField.fieldKey, val),
      error,
      showIcon: false
    };

    switch (buttonField.fieldType) {
      case 'number':
        return <NumberField key={buttonField.id} {...commonProps} />;
      case 'date':
        return <DateField key={buttonField.id} {...commonProps} />;
      case 'datetime':
        return <DateTimeField key={buttonField.id} {...commonProps} />;
      case 'phone':
        return <PhoneField key={buttonField.id} {...commonProps} />;
      case 'zip':
        return <ZipField key={buttonField.id} {...commonProps} />;
      case 'postal_code':
        return <PostalCodeField key={buttonField.id} {...commonProps} />;
      case 'province':
        return <ProvinceField key={buttonField.id} {...commonProps} />;
      case 'state':
        return <StateField key={buttonField.id} {...commonProps} />;
      case 'dropdown':
        return <DropdownField key={buttonField.id} {...commonProps} formData={formData} />;
      case 'email':
        return <TextField key={buttonField.id} {...commonProps} />;
      case 'checkbox':
        return (
          <div key={buttonField.id} className="space-y-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={value === 'True'}
                onChange={(e) => handleFieldChange(buttonField.fieldKey, e.target.checked ? 'True' : 'False')}
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {buttonField.name}
                {buttonField.isRequired && <span className="text-red-500 ml-1">*</span>}
              </span>
            </label>
            {buttonField.helpText && (
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-8">{buttonField.helpText}</p>
            )}
            {error && <p className="text-xs text-red-500 ml-8">{error}</p>}
          </div>
        );
      case 'time':
        return <TimeField key={buttonField.id} {...commonProps} />;
      default:
        return <TextField key={buttonField.id} {...commonProps} />;
    }
  };

  const renderArrayField = (buttonField: ExecuteButtonField, arrayFieldName: string, rowIndex: number) => {
    const rows = arrayData[arrayFieldName] || [];
    const value = rows[rowIndex]?.[buttonField.fieldKey] ?? '';
    const errorKey = `${arrayFieldName}[${rowIndex}].${buttonField.fieldKey}`;
    const error = errors[errorKey];

    const fieldObj = {
      id: `${buttonField.id}-${rowIndex}`,
      fieldLabel: buttonField.name,
      fieldType: buttonField.fieldType,
      isRequired: buttonField.isRequired,
      placeholder: buttonField.placeholder || '',
      helpText: '',
      maxLength: buttonField.maxLength || 0,
      dropdownOptions: buttonField.options,
      dropdownDisplayMode: buttonField.dropdownDisplayMode
    };

    const commonProps = {
      field: fieldObj,
      value,
      onChange: (val: any) => handleArrayFieldChange(arrayFieldName, rowIndex, buttonField.fieldKey, val),
      error,
      showIcon: false
    };

    switch (buttonField.fieldType) {
      case 'number':
        return <NumberField key={fieldObj.id} {...commonProps} />;
      case 'date':
        return <DateField key={fieldObj.id} {...commonProps} />;
      case 'datetime':
        return <DateTimeField key={fieldObj.id} {...commonProps} />;
      case 'phone':
        return <PhoneField key={fieldObj.id} {...commonProps} />;
      case 'zip':
        return <ZipField key={fieldObj.id} {...commonProps} />;
      case 'postal_code':
        return <PostalCodeField key={fieldObj.id} {...commonProps} />;
      case 'province':
        return <ProvinceField key={fieldObj.id} {...commonProps} />;
      case 'state':
        return <StateField key={fieldObj.id} {...commonProps} />;
      case 'dropdown':
        return <DropdownField key={fieldObj.id} {...commonProps} formData={formData} />;
      case 'checkbox':
        return (
          <div key={fieldObj.id} className="flex items-center">
            <input
              type="checkbox"
              checked={value === 'True'}
              onChange={(e) => handleArrayFieldChange(arrayFieldName, rowIndex, buttonField.fieldKey, e.target.checked ? 'True' : 'False')}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
            />
          </div>
        );
      case 'time':
        return <TimeField key={fieldObj.id} {...commonProps} />;
      default:
        return <TextField key={fieldObj.id} {...commonProps} />;
    }
  };

  const renderArrayGroup = (group: ExecuteButtonGroup) => {
    const rows = arrayData[group.arrayFieldName] || [];
    const canAddRow = rows.length < group.arrayMaxRows;
    const canRemoveRow = rows.length > group.arrayMinRows;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {rows.length} / {group.arrayMaxRows} rows
          </span>
          <button
            type="button"
            onClick={() => handleAddRow(group)}
            disabled={!canAddRow}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Row</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-10">
                  #
                </th>
                {currentFields.map(field => (
                  <th
                    key={field.id}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                  >
                    {field.name}
                    {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                  </th>
                ))}
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-16">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {rowIndex + 1}
                  </td>
                  {currentFields.map(field => (
                    <td key={field.id} className="px-3 py-3">
                      {renderArrayField(field, group.arrayFieldName, rowIndex)}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(group, rowIndex)}
                      disabled={!canRemoveRow}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title={canRemoveRow ? 'Remove row' : `Minimum ${group.arrayMinRows} row(s) required`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const hasArrayGroup = groups.some(g => g.isArrayGroup);

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-h-[90vh] flex flex-col ${hasArrayGroup ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {button.name}
            </h3>
            {button.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {button.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                This button has no parameter groups configured.
              </p>
            </div>
          </div>
        ) : (
          <>
            {totalSteps > 1 && (
              <div className="px-6 pt-4">
                <div className="flex items-center justify-center space-x-2">
                  {combinedSteps.map((stepGroups, index) => (
                    <div key={stepGroups.map(g => g.id).join('-')} className="flex items-center">
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                          index < currentStep
                            ? 'bg-green-500 text-white'
                            : index === currentStep
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                        title={stepGroups.map(g => g.name).join(' + ')}
                      >
                        {index < currentStep ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      {index < totalSteps - 1 && (
                        <div
                          className={`w-12 h-1 mx-1 rounded ${
                            index < currentStep
                              ? 'bg-green-500'
                              : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
              {currentStepGroups.length > 0 && (
                <div className="space-y-8">
                  {currentStepGroups.map((group, groupIndex) => {
                    const groupFields = fields.filter(f => f.groupId === group.id);

                    return (
                      <div key={group.id} className={groupIndex > 0 ? 'pt-6 border-t border-gray-200 dark:border-gray-700' : ''}>
                        <div className="mb-6">
                          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {group.name}
                          </h4>
                          {group.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {group.description}
                            </p>
                          )}
                        </div>

                        {group.isArrayGroup && group.arrayFieldName ? (
                          renderArrayGroup(group)
                        ) : (
                          <div className="space-y-4">
                            {groupFields.map(field => renderField(field))}
                            {groupFields.length === 0 && (
                              <p className="text-gray-500 dark:text-gray-400 italic">
                                No fields in this group
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <button
                onClick={isFirstStep ? onClose : handleBack}
                className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                {isFirstStep ? 'Cancel' : 'Back'}
              </button>

              {isLastStep ? (
                <button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="flex items-center px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  {isExecuting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Execute
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
