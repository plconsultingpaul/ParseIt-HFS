import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { OrderEntryField, OrderEntryFieldGroup } from '../../types';
import TextField from './TextField';
import NumberField from './NumberField';
import DateField from './DateField';
import DateTimeField from './DateTimeField';
import PhoneField from './PhoneField';
import ZipField from './ZipField';
import PostalCodeField from './PostalCodeField';
import ProvinceField from './ProvinceField';
import StateField from './StateField';
import DropdownField from './DropdownField';
import BooleanField from './BooleanField';
import FileField from './FileField';
import FieldTypeIcon from '../common/FieldTypeIcon';

interface GroupedArrayTableProps {
  group: OrderEntryFieldGroup;
  fields: OrderEntryField[];
  values: Record<string, any>[];
  errors?: Record<string, string>[];
  onChange: (values: Record<string, any>[]) => void;
  onBlur?: (rowIndex: number, fieldName: string) => void;
}

export default function GroupedArrayTable({
  group,
  fields,
  values,
  errors = [],
  onChange,
  onBlur
}: GroupedArrayTableProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const minRows = group.arrayMinRows || 1;
  const maxRows = group.arrayMaxRows || 10;
  const currentRows = values.length;

  const canAddRow = currentRows < maxRows;
  const canRemoveRow = currentRows > minRows;

  const sortedFields = [...fields].sort((a, b) => a.fieldOrder - b.fieldOrder);

  const handleAddRow = () => {
    if (!canAddRow) return;

    const newRow: Record<string, any> = {};
    sortedFields.forEach(field => {
      if (field.defaultValue) {
        newRow[field.fieldName] = field.defaultValue;
      } else if (field.fieldType === 'boolean') {
        newRow[field.fieldName] = false;
      } else if (field.fieldType === 'file') {
        newRow[field.fieldName] = [];
      } else {
        newRow[field.fieldName] = '';
      }
    });

    onChange([...values, newRow]);
  };

  const handleRemoveRow = (index: number) => {
    if (!canRemoveRow) return;
    setRowToDelete(index);
    setShowDeleteConfirm(true);
  };

  const confirmRemoveRow = () => {
    if (rowToDelete !== null) {
      const newValues = values.filter((_, i) => i !== rowToDelete);
      onChange(newValues);
    }
    setShowDeleteConfirm(false);
    setRowToDelete(null);
  };

  const cancelRemoveRow = () => {
    setShowDeleteConfirm(false);
    setRowToDelete(null);
  };

  const handleFieldChange = (rowIndex: number, fieldName: string, value: any) => {
    const newValues = [...values];
    newValues[rowIndex] = {
      ...newValues[rowIndex],
      [fieldName]: value
    };
    onChange(newValues);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = parseInt(active.id as string);
    const newIndex = parseInt(over.id as string);

    const newValues = [...values];
    const [movedItem] = newValues.splice(oldIndex, 1);
    newValues.splice(newIndex, 0, movedItem);

    onChange(newValues);
  };

  const renderFieldCell = (field: OrderEntryField, rowIndex: number, rowData: Record<string, any>, rowErrors?: Record<string, string>) => {
    const value = rowData[field.fieldName];
    const error = rowErrors?.[field.fieldName];

    const commonProps = {
      field: { ...field, fieldLabel: '' },
      error,
      onBlur: () => onBlur?.(rowIndex, field.fieldName),
      showIcon: false
    };

    switch (field.fieldType) {
      case 'text':
        return <TextField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      case 'number':
        return <NumberField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      case 'date':
        return <DateField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      case 'datetime':
        return <DateTimeField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      case 'phone':
        return <PhoneField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      case 'zip':
        return <ZipField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      case 'postal_code':
        return <PostalCodeField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      case 'province':
        return <ProvinceField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      case 'state':
        return <StateField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      case 'dropdown':
        return <DropdownField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      case 'boolean':
        return <BooleanField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      case 'file':
        return <FileField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
      default:
        return <TextField {...commonProps} value={value} onChange={(v) => handleFieldChange(rowIndex, field.fieldName, v)} />;
    }
  };

  const totalErrors = errors.reduce((count, rowErrors) => count + Object.keys(rowErrors || {}).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {group.groupName}
          </h3>
          {group.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{group.description}</p>
          )}
        </div>
        {!group.hideAddRow && (
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {currentRows} / {maxRows} rows
            </span>
            <button
              type="button"
              onClick={handleAddRow}
              disabled={!canAddRow}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Row</span>
            </button>
          </div>
        )}
      </div>

      {totalErrors > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {totalErrors} validation error{totalErrors !== 1 ? 's' : ''} in this table
          </p>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {!group.hideAddRow && (
                  <th className="w-12 px-3 py-3 text-left">
                    <span className="sr-only">Drag</span>
                  </th>
                )}
                {sortedFields.map(field => (
                  <th
                    key={field.id}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                  >
                    <div className="flex items-center space-x-2">
                      <FieldTypeIcon fieldType={field.fieldType} size="sm" />
                      <span>
                        {field.fieldLabel}
                        {field.isRequired && <span className="text-red-600 dark:text-red-400 ml-1">*</span>}
                      </span>
                    </div>
                  </th>
                ))}
                {!group.hideAddRow && (
                  <th className="w-16 px-3 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <SortableContext items={values.map((_, i) => i.toString())} strategy={verticalListSortingStrategy}>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {values.map((rowData, rowIndex) => (
                  <TableRow
                    key={rowIndex}
                    id={rowIndex.toString()}
                    rowIndex={rowIndex}
                    rowData={rowData}
                    fields={sortedFields}
                    rowErrors={errors[rowIndex]}
                    canRemove={canRemoveRow}
                    hideActions={group.hideAddRow}
                    onRemove={() => handleRemoveRow(rowIndex)}
                    renderField={(field) => renderFieldCell(field, rowIndex, rowData, errors[rowIndex])}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </DndContext>

      {currentRows < minRows && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Minimum {minRows} row{minRows !== 1 ? 's' : ''} required
        </p>
      )}

      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Remove Row?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Are you sure you want to remove row {rowToDelete !== null ? rowToDelete + 1 : ''}? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={cancelRemoveRow}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRemoveRow}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface TableRowProps {
  id: string;
  rowIndex: number;
  rowData: Record<string, any>;
  fields: OrderEntryField[];
  rowErrors?: Record<string, string>;
  canRemove: boolean;
  hideActions?: boolean;
  onRemove: () => void;
  renderField: (field: OrderEntryField) => React.ReactNode;
}

function TableRow({ id, rowIndex, fields, rowErrors, canRemove, hideActions, onRemove, renderField }: TableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasErrors = rowErrors && Object.keys(rowErrors).length > 0;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${
        hasErrors ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-750'
      } ${rowIndex % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-850/50'}`}
    >
      {!hideActions && (
        <td className="px-3 py-2">
          <div className="cursor-move" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
          </div>
        </td>
      )}
      {fields.map(field => (
        <td key={field.id} className="px-3 py-2 align-top">
          {renderField(field)}
        </td>
      ))}
      {!hideActions && (
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Remove row"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      )}
    </tr>
  );
}
