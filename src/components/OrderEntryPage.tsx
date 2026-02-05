import React, { useState, useEffect } from 'react';
import { ClipboardList, AlertCircle, Loader, CheckCircle2, Package, RefreshCw, X } from 'lucide-react';
import type { User, OrderEntryField } from '../types';
import { useOrderEntryForm } from '../hooks/useOrderEntryForm';
import { TextField, NumberField, DateField, DateTimeField, PhoneField, ZipField, PostalCodeField, ZipPostalField, ProvinceField, StateField, DropdownField, FileField, BooleanField } from './form-fields';
import { validateZipPostal } from './form-fields/ZipPostalField';
import ArrayFieldSection from './form-fields/ArrayFieldSection';
import GroupedArrayTable from './form-fields/GroupedArrayTable';
import PdfUploadSection from './order-entry/PdfUploadSection';
import SubmissionSuccessModal from './order-entry/SubmissionSuccessModal';
import SubmissionLoadingOverlay from './order-entry/SubmissionLoadingOverlay';
import { loadSubmissionConfig, submitOrderEntry } from '../services/submissionService';
import FieldTypeIcon from './common/FieldTypeIcon';
import { useToast } from '../hooks/useToast';
import ToastContainer from './common/ToastContainer';
import { FormSkeleton } from './common/Skeleton';
import Modal from './common/Modal';

interface OrderEntryPageProps {
  currentUser: User;
}

export default function OrderEntryPage({ currentUser }: OrderEntryPageProps) {
  const { loading, config, fieldGroups, fields, layouts, error: configError, templateName, extractionTypeId } = useOrderEntryForm({
    clientId: currentUser.clientId
  });
  const toast = useToast();

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, any>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiExtractedFields, setAiExtractedFields] = useState<Set<string>>(new Set());
  const [confidenceScores, setConfidenceScores] = useState<Record<string, number>>({});
  const [uploadedPdfId, setUploadedPdfId] = useState<string | null>(null);
  const [submissionStep, setSubmissionStep] = useState(0);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [pdfResetTrigger, setPdfResetTrigger] = useState(0);

  useEffect(() => {
    if (fields.length > 0 && fieldGroups.length > 0) {
      const initialFormData: Record<string, any> = {};

      fieldGroups.forEach(group => {
        if (group.isArrayGroup) {
          const groupFields = fields.filter(f => f.fieldGroupId === group.id);
          const minRows = group.arrayMinRows || 1;
          const rowData = Array.from({ length: minRows }, () => {
            const row: Record<string, any> = {};
            groupFields.forEach(field => {
              if (field.defaultValue) {
                row[field.fieldName] = field.defaultValue;
              } else if (field.fieldType === 'boolean') {
                row[field.fieldName] = false;
              } else if (field.fieldType === 'file') {
                row[field.fieldName] = [];
              } else {
                row[field.fieldName] = '';
              }
            });
            return row;
          });
          initialFormData[group.id] = rowData;
        }
      });

      fields.forEach((field: OrderEntryField) => {
        const group = fieldGroups.find(g => g.id === field.fieldGroupId);
        if (group?.isArrayGroup) {
          return;
        }

        if (field.defaultValue) {
          initialFormData[field.fieldName] = field.defaultValue;
        } else if (field.isArrayField) {
          initialFormData[field.fieldName] = Array.from({ length: field.arrayMinRows || 1 }, () => ({}));
        } else if (field.fieldType === 'boolean') {
          initialFormData[field.fieldName] = false;
        } else if (field.fieldType === 'file') {
          initialFormData[field.fieldName] = [];
        } else {
          initialFormData[field.fieldName] = '';
        }
      });
      setFormData(initialFormData);
    }
  }, [fields, fieldGroups]);

  const handleExtractionComplete = (extractedData: Record<string, any>, scores: Record<string, number>) => {
    console.log('[handleExtractionComplete] Called with extractedData:', Object.keys(extractedData));
    console.log('[handleExtractionComplete] Fields with copyFromField:',
      fields.filter(f => f.copyFromField).map(f => ({ name: f.fieldName, copyFrom: f.copyFromField })));

    const newAiFields = new Set<string>();
    const newFormData = { ...formData };

    Object.entries(extractedData).forEach(([fieldName, value]) => {
      const confidence = scores[fieldName] || 0;
      console.log(`[handleExtractionComplete] Field "${fieldName}": value="${value}", confidence=${confidence}`);

      if (confidence >= 0.5) {
        const field = fields.find(f => f.fieldName === fieldName);
        let processedValue = value;
        if (field?.fieldType === 'zip_postal' && typeof value === 'string') {
          const cleaned = value.replace(/\s+/g, '').toUpperCase();
          if (/^\d{5}-\d{4}$/.test(cleaned)) {
            processedValue = cleaned.slice(0, 5);
            console.log(`[handleExtractionComplete] Truncated ZIP+4 "${value}" to "${processedValue}"`);
          }
        }
        newFormData[fieldName] = processedValue;
        newAiFields.add(fieldName);
      }
    });

    console.log('[handleExtractionComplete] After extraction, newFormData keys with values:',
      Object.entries(newFormData).filter(([_, v]) => v).map(([k, v]) => `${k}=${v}`));

    Object.entries(newFormData).forEach(([fieldName, value]) => {
      if (!value) return;
      const dependentFields = fields.filter(f => f.copyFromField === fieldName);
      if (dependentFields.length > 0) {
        console.log(`[handleExtractionComplete] Field "${fieldName}" has ${dependentFields.length} dependent fields:`,
          dependentFields.map(f => f.fieldName));
      }
      dependentFields.forEach(depField => {
        const depCurrentValue = newFormData[depField.fieldName];
        console.log(`[handleExtractionComplete] Dependent field "${depField.fieldName}" current value: "${depCurrentValue}"`);
        if (!depCurrentValue || depCurrentValue === '') {
          console.log(`[handleExtractionComplete] COPYING "${value}" to "${depField.fieldName}"`);
          newFormData[depField.fieldName] = value;
          newAiFields.add(depField.fieldName);
        } else {
          console.log(`[handleExtractionComplete] NOT copying - field already has value`);
        }
      });
    });

    console.log('[handleExtractionComplete] Final newFormData:', newFormData);
    console.log('[handleExtractionComplete] Final aiFields:', [...newAiFields]);

    setFormData(newFormData);
    setAiExtractedFields(newAiFields);
    setConfidenceScores(scores);
    toast.success('PDF extracted successfully');
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    console.log(`[OrderEntryPage] handleFieldChange called for "${fieldName}"`, {
      newValue: value,
      previousValue: formData[fieldName]
    });

    const dependentFields = fields.filter(f => f.copyFromField === fieldName);
    const updates: Record<string, any> = { [fieldName]: value };

    if (dependentFields.length > 0) {
      console.log(`[OrderEntryPage] Found ${dependentFields.length} dependent fields for "${fieldName}":`,
        dependentFields.map(f => f.fieldName));
    }

    dependentFields.forEach(depField => {
      if (!formData[depField.fieldName] || formData[depField.fieldName] === '') {
        console.log(`[OrderEntryPage] Copying value to dependent field "${depField.fieldName}"`);
        updates[depField.fieldName] = value;
      }
    });

    console.log(`[OrderEntryPage] Setting formData with updates:`, Object.keys(updates));
    setFormData(prev => ({
      ...prev,
      ...updates
    }));

    if (aiExtractedFields.has(fieldName)) {
      setAiExtractedFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
    }

    if (touched[fieldName]) {
      const field = fields.find(f => f.fieldName === fieldName);
      if (field) {
        const fieldError = validateField(field, value);
        setErrors(prev => {
          const newErrors = { ...prev };
          if (fieldError) {
            newErrors[fieldName] = fieldError;
          } else {
            delete newErrors[fieldName];
          }
          return newErrors;
        });
      }
    }
  };

  const handleFieldBlur = (fieldName: string) => {
    console.log(`[OrderEntryPage] handleFieldBlur called for "${fieldName}"`);
    setTouched(prev => ({ ...prev, [fieldName]: true }));

    const field = fields.find(f => f.fieldName === fieldName);
    if (field) {
      const fieldError = validateField(field, formData[fieldName]);
      setErrors(prev => {
        const newErrors = { ...prev };
        if (fieldError) {
          newErrors[fieldName] = fieldError;
        } else {
          delete newErrors[fieldName];
        }
        return newErrors;
      });
    }
  };

  const validateField = (field: OrderEntryField, value: any): string | null => {
    if (field.isRequired && (!value || value === '' || (Array.isArray(value) && value.length === 0))) {
      return `${field.fieldLabel} is required`;
    }

    if (field.fieldType === 'text' && field.maxLength && value && value.length > field.maxLength) {
      return `${field.fieldLabel} must be ${field.maxLength} characters or less`;
    }

    if (field.fieldType === 'number') {
      const numValue = parseFloat(value);
      if (value && isNaN(numValue)) {
        return `${field.fieldLabel} must be a valid number`;
      }
      if (field.minValue !== undefined && numValue < field.minValue) {
        return `${field.fieldLabel} must be at least ${field.minValue}`;
      }
      if (field.maxValue !== undefined && numValue > field.maxValue) {
        return `${field.fieldLabel} must be at most ${field.maxValue}`;
      }
    }

    if (field.fieldType === 'zip_postal' && value) {
      const validation = validateZipPostal(value);
      if (!validation.isValid) {
        return `${field.fieldLabel} must be a valid US Zip (12345) or Canadian Postal Code (A1A 1A1)`;
      }
    }

    if (field.fieldType === 'zip' && value) {
      if (!/^\d{5}$/.test(value)) {
        return `${field.fieldLabel} must be a valid 5-digit US Zip Code`;
      }
    }

    if (field.fieldType === 'postal_code' && value) {
      if (!/^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$/.test(value)) {
        return `${field.fieldLabel} must be a valid Canadian Postal Code (A1A 1A1)`;
      }
    }

    if (field.validationRegex && value) {
      try {
        const regex = new RegExp(field.validationRegex);
        if (!regex.test(value)) {
          return field.validationErrorMessage || `${field.fieldLabel} format is invalid`;
        }
      } catch (e) {
        console.error('Invalid regex:', field.validationRegex);
      }
    }

    if (field.isArrayField && Array.isArray(value)) {
      if (value.length < field.arrayMinRows) {
        return `${field.fieldLabel} must have at least ${field.arrayMinRows} rows`;
      }
      if (value.length > field.arrayMaxRows) {
        return `${field.fieldLabel} must have at most ${field.arrayMaxRows} rows`;
      }
    }

    return null;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, any> = {};
    const newTouched: Record<string, boolean> = {};

    fields.forEach(field => {
      const group = fieldGroups.find(g => g.id === field.fieldGroupId);
      if (group?.isArrayGroup) return;

      newTouched[field.fieldName] = true;
      const value = formData[field.fieldName];
      const error = validateField(field, value);
      if (error) {
        newErrors[field.fieldName] = error;
      }
    });

    setTouched(newTouched);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitSuccess(false);

    console.log('[OrderEntryPage] ========== SUBMIT BUTTON CLICKED ==========');
    console.log('[OrderEntryPage] Form data:', formData);
    console.log('[OrderEntryPage] User ID:', currentUser.id);
    console.log('[OrderEntryPage] PDF ID:', uploadedPdfId);

    if (!validateForm()) {
      const errorMsg = 'Please fix the errors in the form before submitting';
      console.log('[OrderEntryPage] Form validation failed');
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    console.log('[OrderEntryPage] Form validation passed');

    try {
      setSubmitting(true);
      setSubmissionStep(1);

      console.log('[OrderEntryPage] Loading submission config...');
      const submissionConfig = await loadSubmissionConfig();
      console.log('[OrderEntryPage] Submission config loaded:', submissionConfig);

      if (!submissionConfig) {
        throw new Error('Order submission is not configured. Please contact support.');
      }

      if (!submissionConfig.isEnabled) {
        throw new Error('Order submission is currently disabled. Please try again later.');
      }

      setSubmissionStep(2);

      console.log('[OrderEntryPage] Calling submitOrderEntry...');
      console.log('[OrderEntryPage] Extraction Type ID:', extractionTypeId);
      const result = await submitOrderEntry(
        formData,
        fields,
        currentUser.id,
        uploadedPdfId,
        submissionConfig,
        extractionTypeId,
        fieldGroups
      );

      console.log('[OrderEntryPage] submitOrderEntry result:', result);

      setSubmissionStep(3);

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit order');
      }

      setSubmissionStep(4);

      setSubmissionResult(result);
      setShowSuccessModal(true);
      setSubmitSuccess(true);
      toast.success('Order submitted successfully');
      console.log('[OrderEntryPage] ========== SUBMISSION SUCCESS ==========');

    } catch (err: any) {
      console.error('[OrderEntryPage] ========== SUBMISSION ERROR ==========');
      console.error('[OrderEntryPage] Error:', err);
      console.error('[OrderEntryPage] Error message:', err.message);
      console.error('[OrderEntryPage] Error stack:', err.stack);
      const errorMsg = err.message || 'Failed to submit order';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
      setSubmissionStep(0);
    }
  };

  const handleSubmitAnother = () => {
    setShowSuccessModal(false);
    setSubmitSuccess(false);
    setSubmissionResult(null);
    setUploadedPdfId(null);
    setAiExtractedFields(new Set());
    setConfidenceScores({});
    setPdfResetTrigger(prev => prev + 1);

    const initialFormData: Record<string, any> = {};

    fieldGroups.forEach(group => {
      if (group.isArrayGroup) {
        const groupFields = fields.filter(f => f.fieldGroupId === group.id);
        const minRows = group.arrayMinRows || 1;
        const rowData = Array.from({ length: minRows }, () => {
          const row: Record<string, any> = {};
          groupFields.forEach(field => {
            if (field.defaultValue) {
              row[field.fieldName] = field.defaultValue;
            } else if (field.fieldType === 'boolean') {
              row[field.fieldName] = false;
            } else if (field.fieldType === 'file') {
              row[field.fieldName] = [];
            } else {
              row[field.fieldName] = '';
            }
          });
          return row;
        });
        initialFormData[group.id] = rowData;
      }
    });

    fields.forEach((field: OrderEntryField) => {
      const group = fieldGroups.find(g => g.id === field.fieldGroupId);
      if (group?.isArrayGroup) {
        return;
      }

      if (field.defaultValue) {
        initialFormData[field.fieldName] = field.defaultValue;
      } else if (field.isArrayField) {
        initialFormData[field.fieldName] = Array.from({ length: field.arrayMinRows || 1 }, () => ({}));
      } else if (field.fieldType === 'boolean') {
        initialFormData[field.fieldName] = false;
      } else if (field.fieldType === 'file') {
        initialFormData[field.fieldName] = [];
      } else {
        initialFormData[field.fieldName] = '';
      }
    });
    setFormData(initialFormData);
    setErrors({});
    setTouched({});
    setError(null);
  };

  const handleClearForm = () => {
    const initialFormData: Record<string, any> = {};

    fieldGroups.forEach(group => {
      if (group.isArrayGroup) {
        const groupFields = fields.filter(f => f.fieldGroupId === group.id);
        const minRows = group.arrayMinRows || 1;
        const rowData = Array.from({ length: minRows }, () => {
          const row: Record<string, any> = {};
          groupFields.forEach(field => {
            if (field.defaultValue) {
              row[field.fieldName] = field.defaultValue;
            } else if (field.fieldType === 'boolean') {
              row[field.fieldName] = false;
            } else if (field.fieldType === 'file') {
              row[field.fieldName] = [];
            } else {
              row[field.fieldName] = '';
            }
          });
          return row;
        });
        initialFormData[group.id] = rowData;
      }
    });

    fields.forEach((field: OrderEntryField) => {
      const group = fieldGroups.find(g => g.id === field.fieldGroupId);
      if (group?.isArrayGroup) {
        return;
      }

      if (field.defaultValue) {
        initialFormData[field.fieldName] = field.defaultValue;
      } else if (field.isArrayField) {
        initialFormData[field.fieldName] = Array.from({ length: field.arrayMinRows || 1 }, () => ({}));
      } else if (field.fieldType === 'boolean') {
        initialFormData[field.fieldName] = false;
      } else if (field.fieldType === 'file') {
        initialFormData[field.fieldName] = [];
      } else {
        initialFormData[field.fieldName] = '';
      }
    });

    setFormData(initialFormData);
    setErrors({});
    setTouched({});
    setAiExtractedFields(new Set());
    setConfidenceScores({});
    setUploadedPdfId(null);
    setPdfResetTrigger(prev => prev + 1);
    setError(null);
    setShowClearConfirmModal(false);
    toast.success('Form has been cleared');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <FormSkeleton fields={10} />
      </div>
    );
  }

  const renderField = (field: OrderEntryField) => {
    const value = formData[field.fieldName];
    const error = touched[field.fieldName] ? errors[field.fieldName] : undefined;

    const commonProps = {
      field,
      error,
      onBlur: () => handleFieldBlur(field.fieldName)
    };

    if (field.isArrayField) {
      const arrayFields = fields.filter(f => f.fieldGroupId === field.fieldGroupId && !f.isArrayField);
      return (
        <ArrayFieldSection
          {...commonProps}
          arrayFields={arrayFields}
          values={value || []}
          errors={errors[field.fieldName]}
          onChange={(v) => handleFieldChange(field.fieldName, v)}
        />
      );
    }

    let fieldComponent;
    switch (field.fieldType) {
      case 'text':
        fieldComponent = <TextField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'number':
        fieldComponent = <NumberField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'date':
        fieldComponent = <DateField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'datetime':
        fieldComponent = <DateTimeField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'phone':
        fieldComponent = <PhoneField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'zip':
        fieldComponent = <ZipField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'postal_code':
        fieldComponent = <PostalCodeField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'zip_postal':
        fieldComponent = <ZipPostalField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'province':
        fieldComponent = <ProvinceField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'state':
        fieldComponent = <StateField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'dropdown':
        fieldComponent = <DropdownField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'file':
        fieldComponent = <FileField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      case 'boolean':
        fieldComponent = <BooleanField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
        break;
      default:
        fieldComponent = <TextField {...commonProps} value={value} onChange={(v) => handleFieldChange(field.fieldName, v)} />;
    }

    return fieldComponent;
  };

  const getFieldLayout = (fieldId: string) => {
    return layouts.find(l => l.fieldId === fieldId);
  };

  const groupFieldsByRow = (groupFields: OrderEntryField[]) => {
    const fieldsByRow = new Map<number, Array<{ field: OrderEntryField; layout: any }>>();

    groupFields.forEach(field => {
      const layout = getFieldLayout(field.id);
      const row = layout?.rowIndex ?? 999;

      if (!fieldsByRow.has(row)) {
        fieldsByRow.set(row, []);
      }

      fieldsByRow.get(row)!.push({ field, layout });
    });

    Array.from(fieldsByRow.keys()).forEach(row => {
      fieldsByRow.get(row)!.sort((a, b) => {
        const colA = a.layout?.columnIndex ?? 0;
        const colB = b.layout?.columnIndex ?? 0;
        return colA - colB;
      });
    });

    return fieldsByRow;
  };

  if (configError || !config?.isEnabled) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mr-4 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-2">
              Form Unavailable
            </h3>
            <p className="text-red-700 dark:text-red-400">
              {configError || 'The order entry form is currently unavailable.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (fieldGroups.length === 0 || fields.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 text-center">
          <ClipboardList className="h-12 w-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
            No Form Configured
          </h3>
          <p className="text-yellow-700 dark:text-yellow-400">
            The form has not been set up yet. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const isFormValid = errorCount === 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Request Pickup
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {templateName ? `Using template: ${templateName}` : 'Fill out the form below or upload a document to autofill.'}
            </p>
          </div>
          <PdfUploadSection
            userId={currentUser.id}
            fields={fields}
            onExtractionComplete={handleExtractionComplete}
            onPdfUpload={(pdfId) => setUploadedPdfId(pdfId)}
            onUploadStart={() => toast.info('Uploading PDF...')}
            onUploadError={(error) => toast.error(`Failed to upload PDF: ${error}`)}
            onExtractionStart={() => toast.info('Extracting data from PDF...')}
            onExtractionError={(error) => toast.error(`Failed to extract PDF data: ${error}`)}
            compact
            resetTrigger={pdfResetTrigger}
          />
        </div>
      </div>

      {submitSuccess && (
        <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 flex items-start">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
              Success!
            </h4>
            <p className="text-sm text-green-700 dark:text-green-400">
              Your order has been submitted successfully.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
              Error
            </h4>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {errorCount > 0 && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                Please fix {errorCount} error{errorCount !== 1 ? 's' : ''} before submitting:
              </h4>
              <ul className="space-y-2">
                {Object.entries(errors).slice(0, 5).map(([fieldName, error]) => {
                  const field = fields.find(f => f.fieldName === fieldName);
                  return (
                    <li key={fieldName} className="flex items-start space-x-2">
                      {field && <FieldTypeIcon fieldType={field.fieldType} size="sm" className="mt-0.5 flex-shrink-0" />}
                      <span className="text-sm text-red-700 dark:text-red-400">
                        <span className="font-medium">{field?.fieldLabel || fieldName}:</span> {typeof error === 'string' ? error : 'Invalid value'}
                      </span>
                    </li>
                  );
                })}
                {errorCount > 5 && (
                  <li className="text-sm text-red-600 dark:text-red-400 font-medium ml-6">
                    ... and {errorCount - 5} more errors
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {fieldGroups.map(group => {
          const groupFields = fields.filter(f => f.fieldGroupId === group.id);
          if (groupFields.length === 0) return null;

          if (group.isArrayGroup) {
            return (
              <div
                key={group.id}
                className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg shadow-lg p-6 transition-all"
              >
                <GroupedArrayTable
                  group={group}
                  fields={groupFields}
                  values={formData[group.id] || []}
                  errors={errors[group.id]}
                  onChange={(values) => handleFieldChange(group.id, values)}
                  onBlur={(rowIndex, fieldName) => {
                    setTouched(prev => ({ ...prev, [`${group.id}.${rowIndex}.${fieldName}`]: true }));
                  }}
                />
              </div>
            );
          }

          const fieldsByRow = groupFieldsByRow(groupFields);
          const sortedRows = Array.from(fieldsByRow.keys()).sort((a, b) => a - b);

          return (
            <div
              key={group.id}
              className="rounded-2xl border border-slate-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg shadow-lg p-6 transition-all"
            >
              <div className="mb-6 flex items-center space-x-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {group.groupName}
                  </h2>
                  {group.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {group.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {sortedRows.map(rowIndex => {
                  const rowFields = fieldsByRow.get(rowIndex)!;

                  return (
                    <div key={rowIndex} className="grid grid-cols-12 gap-4">
                      {rowFields.map(({ field, layout }) => {
                        const widthCols = layout?.widthColumns || 12;
                        const colSpanClass = `col-span-12 md:col-span-${widthCols}`;

                        return (
                          <div key={field.id} className={colSpanClass}>
                            {renderField(field)}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-end space-x-4 pt-6 border-t border-slate-200 dark:border-gray-700 rounded-2xl border border-slate-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg shadow-lg p-6 sticky bottom-0">
          <button
            type="button"
            onClick={() => setShowClearConfirmModal(true)}
            className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !isFormValid}
            className="px-6 py-2.5 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {submitting ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Submit Order</span>
              </>
            )}
          </button>
        </div>
      </form>

      <SubmissionLoadingOverlay
        isVisible={submitting}
        currentStep={submissionStep}
      />

      <SubmissionSuccessModal
        isOpen={showSuccessModal}
        submissionId={submissionResult?.submissionId || ''}
        apiResponse={submissionResult?.apiResponse}
        workflowExecutionId={submissionResult?.workflowExecutionId}
        onClose={() => setShowSuccessModal(false)}
        onSubmitAnother={handleSubmitAnother}
      />

      <Modal
        isOpen={showClearConfirmModal}
        onClose={() => setShowClearConfirmModal(false)}
        title="Clear Form"
        size="sm"
      >
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Start Over?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-1">
                Would you like to clear this form and start fresh?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                This will reset all fields including any AI-extracted data.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setShowClearConfirmModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={handleClearForm}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Clear Form</span>
            </button>
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toast.toasts} onClose={toast.closeToast} />
    </div>
  );
}
