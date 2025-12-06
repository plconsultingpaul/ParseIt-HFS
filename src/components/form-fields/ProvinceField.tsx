import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { OrderEntryField } from '../../types';
import FieldTypeIcon from '../common/FieldTypeIcon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProvinceFieldProps {
  field: OrderEntryField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  showIcon?: boolean;
}

const CANADIAN_PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

export default function ProvinceField({ field, value, error, onChange, onBlur, showIcon = true }: ProvinceFieldProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const showSearch = true;

  const filteredProvinces = useMemo(() => {
    if (!searchQuery.trim()) return CANADIAN_PROVINCES;

    const query = searchQuery.toLowerCase();
    return CANADIAN_PROVINCES.filter((province) =>
      province.code.toLowerCase().includes(query) ||
      province.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const displayValue = useMemo(() => {
    if (!value) return null;
    const province = CANADIAN_PROVINCES.find((p) => p.code === value);
    return province ? `${province.code} - ${province.name}` : value;
  }, [value]);

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
          className={`w-full h-[42px] px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:hover:bg-black text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 transition-colors ${
            error
              ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
          }`}
        >
          <SelectValue placeholder={field.placeholder || 'Select a province...'}>
            {displayValue || field.placeholder || 'Select a province...'}
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
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto" style={{ maxHeight: showSearch ? '240px' : '300px' }}>
            {filteredProvinces.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No results found' : 'No provinces available'}
              </div>
            ) : (
              <>
                {filteredProvinces.map((province) => (
                  <SelectItem
                    key={province.code}
                    value={province.code}
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {province.code} - {province.name}
                  </SelectItem>
                ))}
              </>
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
