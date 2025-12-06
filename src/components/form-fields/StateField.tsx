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

interface StateFieldProps {
  field: OrderEntryField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  showIcon?: boolean;
}

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

export default function StateField({ field, value, error, onChange, onBlur, showIcon = true }: StateFieldProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const showSearch = true;

  const filteredStates = useMemo(() => {
    if (!searchQuery.trim()) return US_STATES;

    const query = searchQuery.toLowerCase();
    return US_STATES.filter((state) =>
      state.code.toLowerCase().includes(query) ||
      state.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const displayValue = useMemo(() => {
    if (!value) return null;
    const state = US_STATES.find((s) => s.code === value);
    return state ? `${state.code} - ${state.name}` : value;
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
          className={`w-full h-[42px] px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:hover:bg-black text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 transition-colors ${
            error
              ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500'
          }`}
        >
          <SelectValue placeholder={field.placeholder || 'Select a state...'}>
            {displayValue || field.placeholder || 'Select a state...'}
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
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto" style={{ maxHeight: showSearch ? '240px' : '300px' }}>
            {filteredStates.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No results found' : 'No states available'}
              </div>
            ) : (
              <>
                {filteredStates.map((state) => (
                  <SelectItem
                    key={state.code}
                    value={state.code}
                    className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {state.code} - {state.name}
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
