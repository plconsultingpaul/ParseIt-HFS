import React, { useState } from 'react';
import { Plus, Trash2, Save, FileText, Code, Database, Map, Brain, Copy, Split } from 'lucide-react';
import type { ExtractionType, FieldMapping, ArraySplitConfig } from '../../types';
import { useSupabaseData } from '../../hooks/useSupabaseData';
import MappingPage from '../MappingPage';
import { supabase } from '../../lib/supabase';

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
  const [typeToDelete, setTypeToDelete] = useState<{ index: number; name: string; id?: string } | null>(null);
  const [showTypeSelectionModal, setShowTypeSelectionModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [typeToCopy, setTypeToCopy] = useState<ExtractionType | null>(null);
  const [copyTypeName, setCopyTypeName] = useState('');
  const [copyNameError, setCopyNameError] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [nameError, setNameError] = useState('');
  const [showArraySplitModal, setShowArraySplitModal] = useState(false);
  const [editingArraySplit, setEditingArraySplit] = useState<ArraySplitConfig | null>(null);
  const [arraySplitForm, setArraySplitForm] = useState<Partial<ArraySplitConfig>>({
    targetArrayField: '',
    splitBasedOnField: '',
    splitStrategy: 'one_per_entry'
  });

  const handleAddTypeClick = () => {
    setShowAddModal(true);
    setNewTypeName('');
    setNameError('');
  };

  const handleCopyTypeClick = () => {
    setShowTypeSelectionModal(true);
  };

  const handleTypeSelectedForCopy = (type: ExtractionType) => {
    setTypeToCopy(type);
    setCopyTypeName(`${type.name} - Copy`);
    setCopyNameError('');
    setShowTypeSelectionModal(false);
    setShowCopyModal(true);
  };

  const handleCopyType = async () => {
    if (!copyTypeName.trim()) {
      setCopyNameError('Name is required');
      return;
    }

    // Check if name already exists
    if (localExtractionTypes.some(type => type.name.toLowerCase() === copyTypeName.trim().toLowerCase())) {
      setCopyNameError('Name already exists');
      return;
    }

    if (!typeToCopy) return;

    // Create a deep copy of the original type with a new ID and name
    const copiedType: ExtractionType = {
      ...typeToCopy,
      id: `temp-${Date.now()}`,
      name: copyTypeName.trim(),
      // Deep copy field mappings array
      fieldMappings: typeToCopy.fieldMappings ? typeToCopy.fieldMappings.map(mapping => ({ ...mapping })) : []
    };
    
    const updatedTypes = [...localExtractionTypes, copiedType];
    setLocalExtractionTypes(updatedTypes);
    
    // Automatically save the new type
    try {
      await onUpdateExtractionTypes(updatedTypes);
      
      // Select the new type and close modal
      setSelectedTypeIndex(updatedTypes.length - 1);
      setShowCopyModal(false);
      setTypeToCopy(null);
      setCopyTypeName('');
      setCopyNameError('');
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save copied extraction type:', error);
      setCopyNameError('Failed to save copied type. Please try again.');
    }
  };

  const handleCopyNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCopyType();
    }
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
      formatType: 'CSV',
      jsonPath: '',
      fieldMappings: []
    };
    
    const updatedTypes = [...localExtractionTypes, newType];
    setLocalExtractionTypes(updatedTypes);
    
    // Automatically save the new type to the database
    handleSaveNewType(updatedTypes, updatedTypes.length - 1);
  };

  const handleSaveNewType = async (updatedTypes: ExtractionType[], newTypeIndex: number) => {
    console.log('=== EXTRACTION TYPE SAVE DEBUG START ===');
    console.log('handleSaveNewType called with:');
    console.log('- updatedTypes length:', updatedTypes.length);
    console.log('- newTypeIndex:', newTypeIndex);
    console.log('- updatedTypes:', updatedTypes.map(t => ({ id: t.id, name: t.name, isTemp: t.id.startsWith('temp-') })));
    
    try {
      console.log('Calling onUpdateExtractionTypes...');
      await onUpdateExtractionTypes(updatedTypes);
      console.log('✅ onUpdateExtractionTypes completed successfully');
      
      // Select the new type and close modal
      console.log('Setting selectedTypeIndex to:', newTypeIndex);
      setSelectedTypeIndex(newTypeIndex);
      console.log('Closing modal and clearing form...');
      setShowAddModal(false);
      setNewTypeName('');
      setNameError('');
      
      // Show success message
      console.log('Showing success message...');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      console.log('=== EXTRACTION TYPE SAVE DEBUG SUCCESS ===');
    } catch (error) {
      console.log('=== EXTRACTION TYPE SAVE DEBUG ERROR ===');
      console.error('Failed to save new extraction type:', error);
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error details:', error);
      setNameError('Failed to save extraction type. Please try again.');
      console.log('=== EXTRACTION TYPE SAVE DEBUG ERROR END ===');
    }
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
      if (typeToDelete.id && !typeToDelete.id.startsWith('temp-')) {
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
  };

  const generateFieldMappingsFromTemplateAsync = async (typeIndex: number) => {
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

      // Automatically save the changes to persist the field mappings
      try {
        await onUpdateExtractionTypes(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (error) {
        console.error('Failed to auto-save after mapping JSON:', error);
        alert('Field mappings generated but failed to save automatically. Please use the Save button to save your changes.');
      }

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

  const handleAddArraySplitClick = () => {
    setEditingArraySplit(null);
    setArraySplitForm({
      targetArrayField: '',
      splitBasedOnField: '',
      splitStrategy: 'one_per_entry'
    });
    setShowArraySplitModal(true);
  };

  const handleEditArraySplit = (split: ArraySplitConfig) => {
    setEditingArraySplit(split);
    setArraySplitForm(split);
    setShowArraySplitModal(true);
  };

  const handleSaveArraySplit = async () => {
    if (!arraySplitForm.targetArrayField || !arraySplitForm.splitBasedOnField) {
      alert('Please fill in all required fields');
      return;
    }

    const updated = [...localExtractionTypes];
    const currentType = updated[selectedTypeIndex];

    if (!currentType.arraySplitConfigs) {
      currentType.arraySplitConfigs = [];
    }

    if (editingArraySplit) {
      const index = currentType.arraySplitConfigs.findIndex(s => s.id === editingArraySplit.id);
      if (index !== -1) {
        currentType.arraySplitConfigs[index] = {
          ...editingArraySplit,
          ...arraySplitForm
        };
      }
    } else {
      currentType.arraySplitConfigs.push({
        id: `temp-${Date.now()}`,
        targetArrayField: arraySplitForm.targetArrayField!,
        splitBasedOnField: arraySplitForm.splitBasedOnField!,
        splitStrategy: arraySplitForm.splitStrategy || 'one_per_entry'
      });
    }

    setLocalExtractionTypes(updated);
    setShowArraySplitModal(false);

    try {
      await onUpdateExtractionTypes(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save array split config:', error);
      alert('Failed to save array split configuration. Please try again.');
    }
  };

  const handleDeleteArraySplit = async (splitId: string) => {
    const updated = [...localExtractionTypes];
    const currentType = updated[selectedTypeIndex];

    if (currentType.arraySplitConfigs) {
      currentType.arraySplitConfigs = currentType.arraySplitConfigs.filter(s => s.id !== splitId);
      setLocalExtractionTypes(updated);

      try {
        await onUpdateExtractionTypes(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (error) {
        console.error('Failed to delete array split config:', error);
        alert('Failed to delete array split configuration. Please try again.');
      }
    }
  };

  const selectedType = localExtractionTypes[selectedTypeIndex];

  return (
    <div className="space-y-6">
      {/* Mapping Page Modal */}
      {showMappingPage && (
        <MappingPage onClose={() => setShowMappingPage(false)} />
      )}

      {/* Type Selection Modal */}
      {showTypeSelectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] overflow-hidden">
            <div className="text-center mb-6">
              <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Copy className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Select Extraction Type to Copy</h3>
              <p className="text-gray-600 dark:text-gray-400">Choose which extraction type you want to duplicate</p>
            </div>
            
            {localExtractionTypes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Extraction Types Available</h4>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  You need to create at least one extraction type before you can copy it.
                </p>
                <button
                  onClick={() => setShowTypeSelectionModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors duration-200"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                  {localExtractionTypes.map((type) => (
                    <div
                      key={type.id}
                      onClick={() => handleTypeSelectedForCopy(type)}
                      className="p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:border-purple-300 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="bg-purple-100 dark:bg-purple-800 p-2 rounded-lg">
                            {type.formatType === 'JSON' ? (
                              <Code className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                              {type.name}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {type.formatType} Format • {type.fieldMappings?.length || 0} field mappings
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {type.filename && `Filename: ${type.filename}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-purple-600 dark:text-purple-400">
                          <Copy className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowTypeSelectionModal(false)}
                    className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Copy Type Modal */}
      {showCopyModal && typeToCopy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Copy className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Copy Extraction Type</h3>
              <p className="text-gray-600 dark:text-gray-400">Create a copy of "{typeToCopy.name}" with a new name</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Extraction Type Name
                </label>
                <input
                  type="text"
                  value={copyTypeName}
                  onChange={(e) => setCopyTypeName(e.target.value)}
                  onKeyPress={handleCopyNameKeyPress}
                  placeholder="e.g., Invoice Processing - Copy"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                {copyNameError && (
                  <p className="text-red-500 dark:text-red-400 text-sm mt-2">{copyNameError}</p>
                )}
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <p className="text-blue-700 dark:text-blue-400 text-sm">
                  <strong>What will be copied:</strong> All settings, instructions, template, field mappings, and configuration from the original extraction type.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCopyType}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
                >
                  Copy Extraction Type
                </button>
                <button
                  onClick={() => {
                    setShowCopyModal(false);
                    setTypeToCopy(null);
                    setCopyTypeName('');
                    setCopyNameError('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Type Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-purple-100 dark:bg-purple-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Plus className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Add New Extraction Type</h3>
              <p className="text-gray-600 dark:text-gray-400">Enter a name for your new extraction type</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Extraction Type Name
                </label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyPress={handleNameKeyPress}
                  placeholder="e.g., Invoice Processing"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
                {nameError && (
                  <p className="text-red-500 dark:text-red-400 text-sm mt-2">{nameError}</p>
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
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors duration-200"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Trash2 className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Delete Extraction Type</h3>
              <p className="text-gray-600 dark:text-gray-400">Are you sure you want to delete "{typeToDelete.name}"? This action cannot be undone.</p>
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
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Array Split Configuration Modal */}
      {showArraySplitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Split className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {editingArraySplit ? 'Edit Array Split Configuration' : 'Add Array Split Configuration'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Configure how to split array entries based on a field value
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Array Field
                </label>
                <input
                  type="text"
                  value={arraySplitForm.targetArrayField || ''}
                  onChange={(e) => setArraySplitForm({ ...arraySplitForm, targetArrayField: e.target.value })}
                  placeholder="e.g., barcodes"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  The name of the array field in your JSON template (e.g., "barcodes")
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Split Based On Field
                </label>
                <input
                  type="text"
                  value={arraySplitForm.splitBasedOnField || ''}
                  onChange={(e) => setArraySplitForm({ ...arraySplitForm, splitBasedOnField: e.target.value })}
                  placeholder="e.g., pieces"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  The field name whose value determines how many entries to create (e.g., "pieces")
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Split Strategy
                </label>
                <select
                  value={arraySplitForm.splitStrategy || 'one_per_entry'}
                  onChange={(e) => setArraySplitForm({ ...arraySplitForm, splitStrategy: e.target.value as 'one_per_entry' | 'divide_evenly' })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="one_per_entry">One Per Entry (each entry gets 1)</option>
                  <option value="divide_evenly">Divide Evenly (split total across entries)</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {arraySplitForm.splitStrategy === 'one_per_entry'
                    ? 'If pieces = 3, create 3 entries each with pieces = 1'
                    : 'If pieces = 9, you can manually distribute across entries'}
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Example</h4>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  If your PDF shows "Pieces: 3", the AI will create 3 separate {arraySplitForm.targetArrayField || 'array'} entries,
                  each with {arraySplitForm.splitBasedOnField || 'the field'} = {arraySplitForm.splitStrategy === 'one_per_entry' ? '1' : 'divided value'}.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleSaveArraySplit}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
                >
                  {editingArraySplit ? 'Update Configuration' : 'Add Configuration'}
                </button>
                <button
                  onClick={() => setShowArraySplitModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Extraction Types</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure different types of data extraction templates</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowMappingPage(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Map className="h-4 w-4" />
            <span>Mapping</span>
          </button>
          {localExtractionTypes.length > 0 && (
            <button
              onClick={handleCopyTypeClick}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <Copy className="h-4 w-4" />
              <span>Copy Type</span>
            </button>
          )}
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
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Information Panel */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">How Extraction Types Work</h4>
          <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
            <li>• Extraction types define templates for extracting specific data from PDFs</li>
            <li>• Use field mappings to specify exactly what data to extract (AI, Mapped coordinates, or Hardcoded values)</li>
            <li>• JSON templates use placeholders like {`{{PARSEIT_ID_PLACEHOLDER}}`} that get replaced with actual IDs</li>
            <li>• XML templates can include {`{{PARSEIT_ID_PLACEHOLDER}}`} directly in the XML structure</li>
            <li>• Auto-detection instructions help AI choose the right extraction type automatically</li>
          </ul>
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
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Extraction Type to Edit
              </label>
              <select
                value={selectedTypeIndex}
                onChange={(e) => setSelectedTypeIndex(parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-64"
              >
                {localExtractionTypes.map((type, index) => (
                  <option key={type.id} value={index}>
                    {type.name || `Extraction Type ${index + 1}`} ({type.formatType})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {localExtractionTypes.length} type{localExtractionTypes.length !== 1 ? 's' : ''} total
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {selectedType && (
          <div key={selectedType.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
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
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {selectedType.name || 'New Extraction Type'}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={selectedType.name}
                  onChange={(e) => updateExtractionType(selectedTypeIndex, 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Invoice Data"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Filename
                </label>
                <input
                  type="text"
                  value={selectedType.filename}
                  onChange={(e) => updateExtractionType(selectedTypeIndex, 'filename', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., invoice"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Format Type
                </label>
                <select
                  value={selectedType.formatType}
                  onChange={(e) => updateExtractionType(selectedTypeIndex, 'formatType', e.target.value as 'XML' | 'JSON' | 'CSV')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="XML">XML</option>
                  <option value="JSON">JSON</option>
                  <option value="CSV">CSV</option>
                </select>
              </div>
              {selectedType.formatType === 'JSON' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    JSON API Path
                  </label>
                  <input
                    type="text"
                    value={selectedType.jsonPath || ''}
                    onChange={(e) => updateExtractionType(selectedTypeIndex, 'jsonPath', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., /api/orders"
                  />
                </div>
              )}
              {selectedType.formatType === 'CSV' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      CSV Delimiter
                    </label>
                    <select
                      value={selectedType.csvDelimiter || ','}
                      onChange={(e) => updateExtractionType(selectedTypeIndex, 'csvDelimiter', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value=",">Comma (,)</option>
                      <option value=";">Semicolon (;)</option>
                      <option value="\t">Tab</option>
                      <option value="|">Pipe (|)</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id={`csvHeaders-${selectedTypeIndex}`}
                      checked={selectedType.csvIncludeHeaders !== false}
                      onChange={(e) => updateExtractionType(selectedTypeIndex, 'csvIncludeHeaders', e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-purple-500"
                    />
                    <label htmlFor={`csvHeaders-${selectedTypeIndex}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Include Header Row
                    </label>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        id={`csvMultiPage-${selectedTypeIndex}`}
                        checked={selectedType.csvMultiPageProcessing === true}
                        onChange={(e) => updateExtractionType(selectedTypeIndex, 'csvMultiPageProcessing', e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <label htmlFor={`csvMultiPage-${selectedTypeIndex}`} className="text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer">
                          Process all pages as one CSV document
                        </label>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          When enabled, all pages from a multi-page PDF will be processed together and output as a single CSV file.
                          This is useful for documents where tabular data spans multiple pages (e.g., multi-page invoices, order lists).
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* CSV Row Detection Instructions */}
            {selectedType.formatType === 'CSV' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <span>Row Detection Instructions</span>
                  </div>
                </label>
                <textarea
                  value={selectedType.csvRowDetectionInstructions || ''}
                  onChange={(e) => updateExtractionType(selectedTypeIndex, 'csvRowDetectionInstructions', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
                  rows={3}
                  placeholder="e.g., 'Each Carrier Reference 1 field creates a new row in the CSV'"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Describe what constitutes a new row in the CSV. This helps the AI identify individual records in the PDF.
                </p>
              </div>
            )}

            {/* Workflow Assignment */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assigned Workflow (Optional)
              </label>
              <select
                value={selectedType.workflowId || ''}
                onChange={(e) => updateExtractionType(selectedTypeIndex, 'workflowId', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                When a workflow is assigned, it will be executed after data extraction for additional processing steps.
              </p>
            </div>

            {/* Default Upload Mode */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Default Upload Mode (Optional)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`lockUploadMode-${selectedTypeIndex}`}
                    checked={selectedType.lockUploadMode || false}
                    onChange={(e) => updateExtractionType(selectedTypeIndex, 'lockUploadMode', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-purple-500"
                  />
                  <label htmlFor={`lockUploadMode-${selectedTypeIndex}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Lock Mode
                  </label>
                </div>
              </div>
              <select
                value={selectedType.defaultUploadMode || ''}
                onChange={(e) => updateExtractionType(selectedTypeIndex, 'defaultUploadMode', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">No default (use user preference)</option>
                <option value="manual">Manual Selection</option>
                <option value="auto">AI Auto-Detect</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                When set, the Extract page will automatically default to this upload mode when this extraction type is selected.
                {selectedType.lockUploadMode && ' Lock Mode prevents users from changing the upload mode.'}
              </p>
            </div>


            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Instructions
              </label>
              <textarea
                value={selectedType.defaultInstructions}
                onChange={(e) => updateExtractionType(selectedTypeIndex, 'defaultInstructions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
                rows={3}
                placeholder="Describe what data to extract from the PDF..."
              />
            </div>

            {selectedType.formatType !== 'CSV' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {selectedType.formatType === 'JSON' ? 'JSON Template' : 'XML Template'}
                </label>
                <textarea
                  value={selectedType.formatTemplate}
                  onChange={(e) => updateExtractionType(selectedTypeIndex, 'formatTemplate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical font-mono text-sm"
                  rows={6}
                  placeholder={selectedType.formatType === 'JSON' ?
                    '{\n  "field1": "value1",\n  "field2": "value2"\n}' :
                    '<Trace>\n  <TraceType type="">\n    <Number>{{PARSEIT_ID_PLACEHOLDER}}</Number>\n  </TraceType>\n</Trace>'
                  }
                />
              </div>
            )}

            {/* Auto-Detection Instructions */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center space-x-2">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <span>Auto-Detection Instructions</span>
                </div>
              </label>
              <textarea
                value={selectedType.autoDetectInstructions || ''}
                onChange={(e) => updateExtractionType(selectedTypeIndex, 'autoDetectInstructions', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
                rows={3}
                placeholder="Describe the characteristics that identify this document type (e.g., 'Invoice documents with company letterhead, contains invoice number, billing address, line items with quantities and prices')"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                These instructions help the AI identify when to use this extraction type. Be specific about document layout, key fields, headers, or unique characteristics.
              </p>
            </div>

            {/* Array Split Configuration Section - Only for JSON */}
            {selectedType.formatType === 'JSON' && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <div className="flex items-center space-x-2">
                      <Split className="h-4 w-4 text-blue-600" />
                      <span>Array Split Configuration</span>
                    </div>
                  </label>
                  <button
                    onClick={handleAddArraySplitClick}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center space-x-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Split Rule</span>
                  </button>
                </div>

                {selectedType.arraySplitConfigs && selectedType.arraySplitConfigs.length > 0 ? (
                  <div className="space-y-2">
                    {selectedType.arraySplitConfigs.map((split) => (
                      <div
                        key={split.id}
                        className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                                {split.targetArrayField}
                              </span>
                              <span className="text-xs text-blue-600 dark:text-blue-400">→</span>
                              <span className="text-sm text-blue-800 dark:text-blue-200">
                                split by {split.splitBasedOnField}
                              </span>
                            </div>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                              Strategy: {split.splitStrategy === 'one_per_entry' ? 'One per entry' : 'Divide evenly'}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditArraySplit(split)}
                              className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition-colors duration-200"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteArraySplit(split.id!)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900 rounded transition-colors duration-200"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <Split className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      No array split rules configured
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Add a rule to automatically split arrays based on field values
                    </p>
                  </div>
                )}

                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    <strong>Array splitting</strong> tells the AI to create multiple array entries based on a field value.
                    For example, if "pieces" = 3, create 3 barcode entries each with pieces = 1.
                  </p>
                </div>
              </div>
            )}

            {(selectedType.formatType === 'JSON' || selectedType.formatType === 'CSV') && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedType.formatType === 'CSV' ? 'CSV Column Mappings' : 'Field Mappings'}
                  </label>
                  <div className="flex items-center space-x-2">
                    {selectedType.formatType === 'JSON' && (
                      <button
                        onClick={() => generateFieldMappingsFromTemplateAsync(selectedTypeIndex)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center space-x-1"
                      >
                        <FileText className="h-3 w-3" />
                        <span>Map JSON</span>
                      </button>
                    )}
                    <button
                      onClick={() => addFieldMapping(selectedTypeIndex)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center space-x-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Field</span>
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center space-x-1"
                    >
                      <Save className="h-3 w-3" />
                      <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {(selectedType.fieldMappings || []).map((mapping, mappingIndex) => (
                    <div key={mappingIndex} className={`p-3 rounded-lg border-2 ${
                      mapping.type === 'hardcoded' 
                       ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
                        : mapping.type === 'mapped'
                       ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                       : 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                    }`}>
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Field Name
                          </label>
                          <input
                            type="text"
                            value={mapping.fieldName}
                            onChange={(e) => updateFieldMapping(selectedTypeIndex, mappingIndex, 'fieldName', e.target.value)}
                            className={`w-full px-2 py-1 border-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                              mapping.type === 'hardcoded'
                                ? 'border-green-400 dark:border-green-500'
                                : mapping.type === 'mapped'
                                ? 'border-blue-400 dark:border-blue-500'
                                : 'border-orange-400 dark:border-orange-500'
                            }`}
                            placeholder="fieldName"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Type
                          </label>
                          <select
                            value={mapping.type}
                            onChange={(e) => updateFieldMapping(selectedTypeIndex, mappingIndex, 'type', e.target.value as 'mapped' | 'hardcoded')}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            <option value="ai">AI</option>
                            <option value="mapped">Mapped</option>
                            <option value="hardcoded">Hardcoded</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {mapping.type === 'hardcoded' ? 'Value' : mapping.type === 'mapped' ? 'PDF Coordinates' : 'Description'}
                          </label>
                          <input
                            type="text"
                            value={mapping.value}
                            onChange={(e) => updateFieldMapping(selectedTypeIndex, mappingIndex, 'value', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                            placeholder={
                              mapping.type === 'hardcoded' ? 'Fixed value' : 
                              mapping.type === 'mapped' ? 'e.g., (100, 200, 150, 30)' : 
                              'What to extract'
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Data Type
                          </label>
                          <select
                            value={mapping.dataType || 'string'}
                            onChange={(e) => updateFieldMapping(selectedTypeIndex, mappingIndex, 'dataType', e.target.value as 'string' | 'number' | 'integer' | 'boolean')}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="integer">Integer</option>
                            <option value="datetime">DateTime</option>
                            <option value="phone">Phone Number</option>
                            <option value="boolean">Boolean</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Max Length
                          </label>
                          {(mapping.dataType || 'string') === 'string' ? (
                            <input
                              type="number"
                              value={mapping.maxLength || ''}
                              onChange={(e) => updateFieldMapping(selectedTypeIndex, mappingIndex, 'maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                              placeholder="40"
                              min="1"
                            />
                          ) : (
                            <div className="w-full px-2 py-1 text-xs text-gray-400 dark:text-gray-500 italic">
                              {(mapping.dataType === 'phone') ? 'Auto' : (mapping.dataType === 'boolean') ? 'True/False' : 'N/A'}
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
            <Database className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Extraction Types</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first extraction type to get started.</p>
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