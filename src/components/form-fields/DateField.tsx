import React from 'react';
import { Calendar } from 'lucide-react';
import type { OrderEntryField } from '../../types';
import FieldTypeIcon from '../common/FieldTypeIcon';

interface DateFieldProps {
  field: OrderEntryField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  showIcon?: boolean;
}

export default function DateField({ field, value, error, onChange, onBlur, showIcon = true }: DateFieldProps) {
  return (
    <div>
      {field.fieldLabel && (
        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {showIcon && <FieldTypeIcon fieldType={field.fieldType} size="sm" />}
          <span>{field.fieldLabel}</span>
          {field.isRequired && <span className="text-red-600 dark:text-red-400">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={field.placeholder}
          className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:hover:bg-black text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 transition-colors ${
            error
              ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
      {field.helpText && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{field.helpText}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}
