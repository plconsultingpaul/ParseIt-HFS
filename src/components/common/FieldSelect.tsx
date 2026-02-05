import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { OrderEntryField, DropdownOption, DropdownDisplayMode, DropdownOptionVisibilityRule } from '../../types';
import FieldTypeIcon from './FieldTypeIcon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NormalizedOption {
  value: string;
  description: string;
  displayText: string;
  visibilityRules?: DropdownOptionVisibilityRule[];
}

interface FieldSelectProps {
  field: OrderEntryField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  showIcon?: boolean;
  formData?: Record<string, unknown>;
}

function checkVisibilityRules(
  rules: DropdownOptionVisibilityRule[] | undefined,
  formData: Record<string, unknown> | undefined
): boolean {
  if (!rules || rules.length === 0) return true;
  if (!formData) return true;

  return rules.every(rule => {
    if (!rule.dependsOnField || rule.showWhenValues.length === 0) return true;
    const fieldValue = String(formData[rule.dependsOnField] || '');
    return rule.showWhenValues.some(v => v.toLowerCase() === fieldValue.toLowerCase());
  });
}

export default function FieldSelect({ field, value, error, onChange, onBlur, showIcon = true, formData }: FieldSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const displayMode: DropdownDisplayMode = field.dropdownDisplayMode || 'description_only';

  const normalizedOptions: NormalizedOption[] = useMemo(() => {
    if (!Array.isArray(field.dropdownOptions)) return [];

    return field.dropdownOptions
      .filter(opt => opt && (typeof opt === 'string' ? opt.trim().length > 0 : opt.value?.trim().length > 0))
      .map(opt => {
        if (typeof opt === 'string') {
          return { value: opt, description: opt, displayText: opt };
        }
        const typedOpt = opt as DropdownOption;
        const displayText = displayMode === 'value_and_description'
          ? `${typedOpt.value} - ${typedOpt.description}`
          : typedOpt.description || typedOpt.value;
        return {
          value: typedOpt.value,
          description: typedOpt.description,
          displayText,
          visibilityRules: typedOpt.visibilityRules
        };
      });
  }, [field.dropdownOptions, displayMode]);

  const visibleOptions = useMemo(() => {
    return normalizedOptions.filter(opt =>
      checkVisibilityRules(opt.visibilityRules, formData)
    );
  }, [normalizedOptions, formData]);

  const showSearch = visibleOptions.length >= 10;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return visibleOptions;

    const query = searchQuery.toLowerCase();
    return visibleOptions.filter((option) =>
      option.value.toLowerCase().includes(query) ||
      option.description.toLowerCase().includes(query)
    );
  }, [visibleOptions, searchQuery]);

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  return (
    <div>
      {field.fieldLabel && (
        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {showIcon && <FieldTypeIcon fieldType={field.fieldType} size="sm" />}
          <span>{field.fieldLabel}</span>
          {field.isRequired && <span className="text-red-600 dark:text-red-400">*</span>}
        </label>
      )}

      <Select value={value || ''} onValueChange={onChange} onOpenChange={(open) => !open && onBlur?.()}>
        <SelectTrigger
          className={`w-full h-[42px] px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:hover:bg-black text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 transition-colors ${
            error
              ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
          }`}
        >
          <SelectValue placeholder={field.placeholder || 'Select an option...'}>
            {selectedOption?.displayText}
          </SelectValue>
        </SelectTrigger>

        <SelectContent
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          style={{ maxHeight: '300px' }}
        >
          {showSearch && (
            <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto" style={{ maxHeight: showSearch ? '240px' : '300px' }}>
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No results found' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <SelectItem
                  key={index}
                  value={option.value}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {option.displayText}
                </SelectItem>
              ))
            )}
          </div>
        </SelectContent>
      </Select>

      {field.helpText && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{field.helpText}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}
