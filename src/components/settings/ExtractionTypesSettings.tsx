import React, { useState } from 'react';
import { Plus, Trash2, Save, FileText, Code, Database, Map, Brain } from 'lucide-react';
import type { ExtractionType, FieldMapping } from '../../types';
import { useSupabaseData } from '../../hooks/useSupabaseData';
import MappingPage from '../MappingPage';

interface ExtractionTypesSettingsProps {
  extractionTypes: ExtractionType[];
  onUpdateExtractionTypes: (types: ExtractionType[]) => Promise<void>;
  onDeleteExtractionType: (id: string) => Promise<void>;
}

export default function ExtractionTypesSettings({ 
  extractionTypes, 
  onUpdateExtractionTypes,
  onDeleteExtractionType
}: ExtractionTypesSettingsProps) {
  const { workflows } = useSupabaseData();
  const [localExtractionTypes, setLocalExtractionTypes] = useState<ExtractionType[]>(extractionTypes);
  const [selectedTypeIndex, setSelectedTypeIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMappingPage, setShowMappingPage] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<{ index: number; name: string } | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [nameError, setNameError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<{ index: number; name: string; id: string } | null>(null);

  const handleAddTypeClick = () => {
    setShowAddModal(true);
    setNewTypeName('');
    setNameError('');
  };

  const handleAddType = () => {
    if (!newTypeName.trim()) {
      setNameError('Name is required');
      return;
    }

    // Check if name already exists
    if (localExtractionTypes.some(type => type.name.toLowerCase() === newTypeName.trim().toLowerCase())) {
      setNameError('Name already exists');
      return;
    }

    const newType: ExtractionType = {
      id: `temp-${Date.now()}`,
      name: newTypeName.trim(),
      defaultInstructions: '',
      formatTemplate: '',
      filename: '',
      formatType: 'XML',
      jsonPath: '',
      fieldMappings: []
    };
    
    const updatedTypes = [...localExtractionTypes, newType];
    setLocalExtractionTypes(updatedTypes);
    
    // Select the new type
    setSelectedTypeIndex(updatedTypes.length - 1);
    
    // Close modal
    setShowAddModal(false);
    setNewTypeName('');
    setNameError('');
  };

  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddType();
    }
  };

  const updateExtractionType = (index: number, field: keyof ExtractionType, value: any) => {
    const updated = [...localExtractionTypes];
    updated[index] = { ...updated[index], [field]: value };
    setLocalExtractionTypes(updated);
  };

  const removeExtractionType = (index: number) => {
    const updated = localExtractionTypes.filter((_, i) => i !== index);
    setLocalExtractionTypes(updated);
    // Adjust selected index if needed
    if (selectedTypeIndex >= updated.length) {
      setSelectedTypeIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleDeleteClick = (index: number) => {
    const typeToDelete = localExtractionTypes[index];
    setTypeToDelete({ index, name: typeToDelete.name, id: typeToDelete.id });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!typeToDelete) return;
    
    try {
      // Only call database delete if this is not a temporary type
      if (!typeToDelete.id.startsWith('temp-')) {
        await onDeleteExtractionType(typeToDelete.id);
      }
      
      // Remove from local state
      removeExtractionType(typeToDelete.index);
      
      setShowDeleteModal(false);
      setTypeToDelete(null);
    } catch (error) {
      console.error('Failed to delete extraction type:', error);
      alert('Failed to delete extraction type. Please try again.');
    }
  };

  const handleDeleteClick = () => {
    if (localExtractionTypes.length === 0) return;
    
    const typeToDelete = localExtractionTypes[selectedTypeIndex];
    setTypeToDelete({ index: selectedTypeIndex, name: typeToDelete.name });
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (typeToDelete) {
      removeExtractionType(typeToDelete.index);
      setShowDeleteModal(false);
      setTypeToDelete(null);
    }
  };

  const handleDeleteFromDatabase = async (extractionTypeId: string, index: number) => {
    try {
      await onDeleteExtractionType(extractionTypeId);
      // Remove from local state after successful database deletion
      removeExtractionType(index);
    } catch (error) {
      console.error('Failed to delete extraction type:', error);
    }
  };

  const addFieldMapping = (typeIndex: number) => {
    const updated = [...localExtractionTypes];
    const newMapping: FieldMapping = {
      fieldName: '',
      type: 'mapped',
      value: '',
      dataType: 'string'
    };
    updated[typeIndex].fieldMappings = [...(updated[typeIndex].fieldMappings || []), newMapping];
    setLocalExtractionTypes(updated);
  };

  const updateFieldMapping = (typeIndex: number, mappingIndex: number, field: keyof FieldMapping, value: any) => {
    const updated = [...localExtractionTypes];
    const mappings = [...(updated[typeIndex].fieldMappings || [])];
    mappings[mappingIndex] = { ...mappings[mappingIndex], [field]: value };
    updated[typeIndex].fieldMappings = mappings;
    setLocalExtractionTypes(updated);
  };

  const removeFieldMapping = (typeIndex: number, mappingIndex: number) => {
    const updated = [...localExtractionTypes];
    const mappings = (updated[typeIndex].fieldMappings || []).filter((_, i) => i !== mappingIndex);
    updated[typeIndex].fieldMappings = mappings;
    setLocalExtractionTypes(updated);
  };

  const generateFieldMappingsFromTemplate = (typeIndex: number) => {
    const extractionType = localExtractionTypes[typeIndex];
    if (!extractionType.formatTemplate) {
      alert('Please add a JSON template first');
      return;
    }

    try {
      // Parse the JSON template to extract field names
      const template = JSON.parse(extractionType.formatTemplate);
      const fieldMappings: FieldMapping[] = [];

      const extractFields = (obj: any, prefix = '', isArrayItem = false) => {
        for (const [key, value] of Object.entries(obj)) {
          const fieldName = prefix ? `${prefix}.${key}` : key;
          
          if (Array.isArray(value) && value.length > 0) {
            // Handle arrays - extract fields from the first item
            const firstItem = value[0];
            if (firstItem && typeof firstItem === 'object') {
              extractFields(firstItem, fieldName, true);
            }
          } else if (value && typeof value === 'object') {
            // Nested object - recurse
            extractFields(value, fieldName);
          } else {
            // Determine data type based on the template value
            let dataType: 'string' | 'number' | 'integer' | 'datetime' = 'string';
            
            if (typeof value === 'number') {
              dataType = Number.isInteger(value) ? 'integer' : 'number';
            } else if (typeof value === 'boolean') {
              dataType = 'string'; // Treat booleans as strings for hardcoded values
            } else if (typeof value === 'string') {
              // Check if it looks like a datetime
              if (/^\d{4}-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12]\d)((T| )([01]\d|2[0-3]):([0-5]\d):([0-5]\d))?$/.test(value)) {
                dataType = 'datetime';
              }
            }

            // Create a readable description from the field name and path
            const description = `Extract ${key.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}${prefix ? ` from ${prefix.replace(/\./g, ' → ')}` : ''}`;
            
            // Add all fields (both nested and root-level)
            fieldMappings.push({
              fieldName: fieldName,
              type: 'ai',
              value: '',
              dataType
            });
          }
        }
      };

      // Extract fields from the array items (skip the top-level "orders" container)
      for (const [topKey, topValue] of Object.entries(template)) {
        if (Array.isArray(topValue) && topValue.length > 0) {
          // If top level is an array, extract from the first item
          const firstItem = topValue[0];
          if (firstItem && typeof firstItem === 'object') {
            extractFields(firstItem, '');
          }
        }
      }

      // Update the extraction type with the generated mappings
      const updated = [...localExtractionTypes];
      updated[typeIndex].fieldMappings = fieldMappings;
      setLocalExtractionTypes(updated);

    } catch (error) {
      alert('Invalid JSON template. Please check the JSON syntax.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateExtractionTypes(localExtractionTypes);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save extraction types:', error);
      alert('Failed to save extraction types. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedType = localExtractionTypes[selectedTypeIndex];

  return (
    <div className="space-y-6">
      {/* Mapping Page Modal */}
      {showMappingPage && (
        <MappingPage onClose={() => setShowMappingPage(false)} />
      )}

      {/* Add Type Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-purple-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Plus className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Add New Extraction Type</h3>
              <p className="text-gray-600">Enter a name for your new extraction type</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Extraction Type Name
                </label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyPress={handleNameKeyPress}
                  placeholder="e.g., Invoice Processing"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
                {nameError && (
                  <p className="text-red-500 text-sm mt-2">{nameError}</p>
                )}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleAddType}
                  className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200"
                >
                  Create Extraction Type
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && typeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-red-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Extraction Type</h3>
              <p className="text-gray-600">Are you sure you want to delete "{typeToDelete.name}"? This action cannot be undone.</p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && typeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-red-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Extraction Type</h3>
              <p className="text-gray-600">Are you sure you want to delete "{typeToDelete.name}"? This action cannot be undone.</p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTypeToDelete(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Extraction Types</h3>
          <p className="text-gray-600 mt-1">Configure different types of data extraction templates</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowMappingPage(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Map className="h-4 w-4" />
            <span>Mapping</span>
          </button>
          <button
            onClick={handleAddTypeClick}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Type</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save All'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="font-semibold text-green-800">Success!</span>
          </div>
          <p className="text-green-700 text-sm mt-1">Extraction types saved successfully!</p>
        </div>
      )}

      {/* Extraction Type Selector */}
      {localExtractionTypes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Extraction Type to Edit
              </label>
              <select
                value={selectedTypeIndex}
                onChange={(e) => setSelectedTypeIndex(parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-64"
              >
                {localExtractionTypes.map((type, index) => (
                  <option key={type.id} value={index}>
                    {type.name || `Extraction Type ${index + 1}`} ({type.formatType})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500">
              {localExtractionTypes.length} type{localExtractionTypes.length !== 1 ? 's' : ''} total
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {selectedType && (
          <div key={selectedType.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  {selectedType.formatType === 'JSON' ? (
                    <Code className="h-5 w-5 text-purple-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-purple-600" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {selectedType.name || 'New Extraction Type'}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {selectedType.formatType} Format
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteClick(selectedTypeIndex)}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={selectedType.name}
                  onChange={(e) => updateExtractionType(selectedTypeIndex, 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Invoice Data"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filename
                </label>
                <input
                  type="text"
                  value={selectedType.filename}
                  onChange={(e) => updateExtractionType(selectedTypeIndex, 'filename', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., invoice"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format Type
                </label>
                <select
                  value={selectedType.formatType}
                  onChange={(e) => updateExtractionType(selectedTypeIndex, 'formatType', e.target.value as 'XML' | 'JSON')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="XML">XML</option>
                  <option value="JSON">JSON</option>
                </select>
              </div>
              {selectedType.formatType === 'JSON' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    JSON API Path
                  </label>
                  <input
                    type="text"
                    value={selectedType.jsonPath || ''}
                    onChange={(e) => updateExtractionType(selectedTypeIndex, 'jsonPath', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., /api/orders"
                  />
                </div>
              )}
            </div>

            {/* Workflow Assignment */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned Workflow (Optional)
              </label>
              <select
                value={selectedType.workflowId || ''}
                onChange={(e) => updateExtractionType(selectedTypeIndex, 'workflowId', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">No workflow assigned</option>
                {workflows
                  .filter(w => w.isActive)
                  .map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                When a workflow is assigned, it will be executed after data extraction for additional processing steps.
              </p>
            </div>

            {(selectedType.formatType === 'JSON' || selectedType.formatType === 'XML') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ParseIt ID Mapping ({selectedType.formatType})
                </label>
                <input
                  type="text"
                  value={selectedType.parseitIdMapping || ''}
                  onChange={(e) => updateExtractionType(selectedTypeIndex, 'parseitIdMapping', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder={selectedType.formatType === 'JSON' 
                    ? "e.g., parseitId or order.id or metadata.parseitId"
                    : "e.g., /Trace/TraceType/Number or /root/order/id"
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  {selectedType.formatType === 'JSON' 
                    ? 'Specify the JSON field path where the ParseIt ID should be injected (e.g., "parseitId" for root level, "order.parseitId" for nested)'
                    : 'For XML: Use {{PARSEIT_ID_PLACEHOLDER}} directly in your XML template. This field is for documentation only.'
                  }
                </p>
              </div>
            )}

            {selectedType.formatType === 'JSON' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trace Type Field Mapping
                  </label>
                  <input
                    type="text"
                    value={selectedType.traceTypeMapping || ''}
                    onChange={(e) => updateExtractionType(selectedTypeIndex, 'traceTypeMapping', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., traceNumbers.traceType"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional: Field path for trace type (JSON only)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trace Type Value
                  </label>
                  <input
                    type="text"
                    value={selectedType.traceTypeValue || ''}
                    onChange={(e) => updateExtractionType(selectedTypeIndex, 'traceTypeValue', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., 1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Value to set for trace type field (JSON only)
                  </p>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Instructions
              </label>
              <textarea
                value={selectedType.defaultInstructions}
                onChange={(e) => updateExtractionType(selectedTypeIndex, 'defaultInstructions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
                rows={3}
                placeholder="Describe what data to extract from the PDF..."
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {selectedType.formatType === 'JSON' ? 'JSON Template' : 'XML Template'}
              </label>
              <textarea
                value={selectedType.formatTemplate}
                onChange={(e) => updateExtractionType(selectedTypeIndex, 'formatTemplate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical font-mono text-sm"
                rows={6}
                placeholder={selectedType.formatType === 'JSON' ? 
                  '{\n  "field1": "value1",\n  "field2": "value2"\n}' : 
                  '<Trace>\n  <TraceType type="">\n    <Number>{{PARSEIT_ID_PLACEHOLDER}}</Number>\n  </TraceType>\n</Trace>'
                }
              />
            </div>

            {/* Auto-Detection Instructions */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center space-x-2">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <span>Auto-Detection Instructions</span>
                </div>
              </label>
              <textarea
                value={selectedType.autoDetectInstructions || ''}
                onChange={(e) => updateExtractionType(selectedTypeIndex, 'autoDetectInstructions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
                rows={3}
                placeholder="Describe the characteristics that identify this document type (e.g., 'Invoice documents with company letterhead, contains invoice number, billing address, line items with quantities and prices')"
              />
              <p className="text-xs text-gray-500 mt-1">
                These instructions help the AI identify when to use this extraction type. Be specific about document layout, key fields, headers, or unique characteristics.
              </p>
            </div>
            {selectedType.formatType === 'JSON' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Field Mappings
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => generateFieldMappingsFromTemplate(selectedTypeIndex)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center space-x-1"
                    >
                      <FileText className="h-3 w-3" />
                      <span>Map JSON</span>
                    </button>
                    <button
                      onClick={() => addFieldMapping(selectedTypeIndex)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center space-x-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Field</span>
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {(selectedType.fieldMappings || []).map((mapping, mappingIndex) => (
                    <div key={mappingIndex} className={`p-3 rounded-lg border-2 ${
                      mapping.type === 'hardcoded' 
                        ? 'bg-green-50 border-green-300' 
                        : mapping.type === 'mapped'
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-orange-50 border-orange-300'
                    }`}>
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Field Name
                          </label>
                          <input
                            type="text"
                            value={mapping.fieldName}
                            onChange={(e) => updateFieldMapping(selectedTypeIndex, mappingIndex, 'fieldName', e.target.value)}
                            className={`w-full px-2 py-1 border-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                              mapping.type === 'hardcoded'
                                ? 'border-green-400 bg-green-25'
                                : mapping.type === 'mapped'
                                ? 'border-blue-400 bg-blue-25'
                                : 'border-orange-400 bg-orange-25'
                            }`}
                            placeholder="fieldName"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Type
                          </label>
                          <select
                            value={mapping.type}
                            onChange={(e) => updateFieldMapping(selectedTypeIndex, mappingIndex, 'type', e.target.value as 'mapped' | 'hardcoded')}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            <option value="ai">AI</option>
                            <option value="mapped">Mapped</option>
                            <option value="hardcoded">Hardcoded</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {mapping.type === 'hardcoded' ? 'Value' : mapping.type === 'mapped' ? 'PDF Coordinates' : 'Description'}
                          </label>
                          <input
                            type="text"
                            value={mapping.value}
                            onChange={(e) => updateFieldMapping(selectedTypeIndex, mappingIndex, 'value', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                            placeholder={
                              mapping.type === 'hardcoded' ? 'Fixed value' : 
                              mapping.type === 'mapped' ? 'e.g., (100, 200, 150, 30)' : 
                              'What to extract'
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Data Type
                          </label>
                          <select
                            value={mapping.dataType || 'string'}
                            onChange={(e) => updateFieldMapping(selectedTypeIndex, mappingIndex, 'dataType', e.target.value as 'string' | 'number' | 'integer')}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="integer">Integer</option>
                            <option value="datetime">DateTime</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Max Length
                          </label>
                          {(mapping.dataType || 'string') === 'string' ? (
                            <input
                              type="number"
                              value={mapping.maxLength || ''}
                              onChange={(e) => updateFieldMapping(selectedTypeIndex, mappingIndex, 'maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                              placeholder="40"
                              min="1"
                            />
                          ) : (
                            <div className="w-full px-2 py-1 text-xs text-gray-400 italic">
                              N/A
                            </div>
                          )}
                        </div>
                        <div>
                          <button
                            onClick={() => removeFieldMapping(selectedTypeIndex, mappingIndex)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {localExtractionTypes.length === 0 && (
          <div className="text-center py-12">
            <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Extraction Types</h3>
            <p className="text-gray-600 mb-4">Create your first extraction type to get started.</p>
            <button
              onClick={handleAddTypeClick}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Add Extraction Type</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}