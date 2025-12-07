import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, CheckCircle, X, ArrowRight, Loader2, AlertCircle, Delete } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { detectExtractionType } from '../lib/geminiDetector';
import { executeWorkflow } from '../lib/workflow';
import DocumentScanner from './DocumentScanner';
import type { ExtractionType, DriverCheckinSettings } from '../types';
import { geminiConfigService } from '../services/geminiConfigService';

type CheckinStep = 'phone' | 'info' | 'confirm' | 'scan' | 'complete';

interface ScannedDocument {
  file: File;
  preview: string;
  order: number;
}

export default function DriverCheckinPage() {
  const [step, setStep] = useState<CheckinStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [bolsCount, setBolsCount] = useState(1);
  const [doorNumber, setDoorNumber] = useState('');
  const [existingDriver, setExistingDriver] = useState(false);
  const [driverCheckinId, setDriverCheckinId] = useState<string | null>(null);
  const [checkinLogId, setCheckinLogId] = useState<string | null>(null);
  const [scannedDocuments, setScannedDocuments] = useState<ScannedDocument[]>([]);
  const [currentScanNumber, setCurrentScanNumber] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState<DriverCheckinSettings | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [extractionTypes, setExtractionTypes] = useState<ExtractionType[]>([]);
  const [forceDarkMode, setForceDarkMode] = useState<boolean | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    loadSettings();
    loadExtractionTypes();
    loadGeminiApiKey();
  }, []);

  useEffect(() => {
    return () => {
      if (forceDarkMode !== null) {
        document.documentElement.classList.remove('dark');
        const stored = localStorage.getItem('darkMode');
        if (stored !== null && JSON.parse(stored)) {
          document.documentElement.classList.add('dark');
        }
      }
    };
  }, [forceDarkMode]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('driver_checkin_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const darkMode = data.dark_mode_enabled || false;
        setSettings({
          id: data.id,
          fallbackWorkflowId: data.fallback_workflow_id,
          additionalFields: data.additional_fields || [],
          isEnabled: data.is_enabled,
          darkModeEnabled: darkMode,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        });
        setForceDarkMode(darkMode);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  useEffect(() => {
    if (forceDarkMode !== null) {
      if (forceDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [forceDarkMode]);

  const loadGeminiApiKey = async () => {
    try {
      const config = await geminiConfigService.getActiveConfiguration();
      setGeminiApiKey(config?.apiKey || '');
    } catch (err) {
      console.error('Error loading Gemini API key:', err);
    }
  };

  const loadExtractionTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('extraction_types')
        .select('*')
        .order('name');

      if (error) throw error;

      if (data) {
        const types: ExtractionType[] = data.map((type: any) => ({
          id: type.id,
          name: type.name,
          defaultInstructions: type.default_instructions || '',
          formatTemplate: type.format_template || '',
          filename: type.filename || '',
          formatType: type.format_type || 'JSON',
          jsonPath: type.json_path,
          fieldMappings: type.field_mappings,
          parseitIdMapping: type.parseit_id_mapping,
          traceTypeMapping: type.trace_type_mapping,
          traceTypeValue: type.trace_type_value,
          workflowId: type.workflow_id,
          autoDetectInstructions: type.auto_detect_instructions,
          csvDelimiter: type.csv_delimiter,
          csvIncludeHeaders: type.csv_include_headers,
          csvRowDetectionInstructions: type.csv_row_detection_instructions,
          csvMultiPageProcessing: type.csv_multi_page_processing,
          defaultUploadMode: type.default_upload_mode,
          lockUploadMode: type.lock_upload_mode
        }));
        setExtractionTypes(types);
      }
    } catch (err) {
      console.error('Error loading extraction types:', err);
    }
  };

  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '');

    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handlePhoneSubmit = async () => {
    const digits = phoneNumber.replace(/\D/g, '');

    if (!phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    if (digits.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('driver_checkins')
        .select('*')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setExistingDriver(true);
        setDriverCheckinId(data.id);
        setName(data.name);
        setCompany(data.company);
        setStep('confirm');
      } else {
        setExistingDriver(false);
        setStep('info');
      }
    } catch (err) {
      console.error('Error checking driver:', err);
      setError('Failed to check driver information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeypadNumber = (digit: string) => {
    const currentDigits = phoneNumber.replace(/\D/g, '');
    if (currentDigits.length < 10) {
      const newNumber = currentDigits + digit;
      setPhoneNumber(formatPhoneNumber(newNumber));
    }
  };

  const handleKeypadBackspace = () => {
    const currentDigits = phoneNumber.replace(/\D/g, '');
    const newDigits = currentDigits.slice(0, -1);
    setPhoneNumber(formatPhoneNumber(newDigits));
  };

  const handleKeypadClear = () => {
    setPhoneNumber('');
  };

  const handleInfoSubmit = async () => {
    if (!name.trim() || !company.trim()) {
      setError('Please enter both name and company');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('driver_checkins')
        .insert([{
          phone_number: phoneNumber,
          name: name,
          company: company
        }])
        .select()
        .single();

      if (error) throw error;

      setDriverCheckinId(data.id);
      setStep('confirm');
    } catch (err) {
      console.error('Error creating driver:', err);
      setError('Failed to save driver information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!bolsCount || bolsCount < 1) {
      setError('Please enter the number of BOLs');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('driver_checkin_logs')
        .insert([{
          driver_checkin_id: driverCheckinId,
          phone_number: phoneNumber,
          name: name,
          company: company,
          bols_count: bolsCount,
          door_number: doorNumber.trim() ? parseInt(doorNumber) : null,
          status: 'scanning'
        }])
        .select()
        .single();

      if (error) throw error;

      setCheckinLogId(data.id);
      setStep('scan');
    } catch (err) {
      console.error('Error creating check-in log:', err);
      setError('Failed to save check-in information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanComplete = (pdfFile: File) => {
    const preview = URL.createObjectURL(pdfFile);
    setScannedDocuments(prev => [...prev, { file: pdfFile, preview, order: currentScanNumber }]);
    setCurrentScanNumber(prev => prev + 1);
    setShowScanner(false);
  };

  const handleScanCancel = () => {
    setShowScanner(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const preview = URL.createObjectURL(file);

    setScannedDocuments(prev => [...prev, { file, preview, order: currentScanNumber }]);
    setCurrentScanNumber(prev => prev + 1);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeDocument = (order: number) => {
    setScannedDocuments(prev => prev.filter(doc => doc.order !== order));
  };

  const processDocuments = async () => {
    if (scannedDocuments.length !== bolsCount) {
      setError(`Please scan all ${bolsCount} BOL document(s)`);
      return;
    }

    if (!checkinLogId) {
      setError('Check-in session not found');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      await supabase
        .from('driver_checkin_logs')
        .update({ status: 'processing' })
        .eq('id', checkinLogId);

      for (const doc of scannedDocuments) {
        const timestamp = Date.now();
        const sanitizedPhone = phoneNumber.replace(/[^0-9]/g, '');
        const storagePath = `driver-checkin/${sanitizedPhone}/${timestamp}-bol-${doc.order}.pdf`;

        const { error: uploadError } = await supabase.storage
          .from('pdfs')
          .upload(storagePath, doc.file, {
            contentType: 'application/pdf',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: docRecord, error: docError } = await supabase
          .from('driver_checkin_documents')
          .insert([{
            driver_checkin_log_id: checkinLogId,
            pdf_filename: doc.file.name,
            pdf_storage_path: storagePath,
            document_order: doc.order,
            processing_status: 'processing'
          }])
          .select()
          .single();

        if (docError) throw docError;

        try {
          let workflowId = settings?.fallbackWorkflowId;
          let extractionTypeId = null;

          if (geminiApiKey && extractionTypes.length > 0) {
            const detectionResult = await detectExtractionType({
              pdfFile: doc.file,
              extractionTypes: extractionTypes,
              apiKey: geminiApiKey
            });

            if (detectionResult.detectedTypeId && detectionResult.confidence === 'high') {
              extractionTypeId = detectionResult.detectedTypeId;
              const extractionType = extractionTypes.find(t => t.id === extractionTypeId);
              if (extractionType?.workflowId) {
                workflowId = extractionType.workflowId;
              }
            }
          }

          await supabase
            .from('driver_checkin_documents')
            .update({
              extraction_type_id: extractionTypeId,
              workflow_id: workflowId
            })
            .eq('id', docRecord.id);

          if (workflowId) {
            const pdfBase64 = await fileToBase64(doc.file);

            await executeWorkflow({
              extractedData: '',
              workflowId: workflowId,
              extractionTypeId: extractionTypeId || undefined,
              pdfFilename: doc.file.name,
              pdfPages: 1,
              pdfBase64: pdfBase64,
              originalPdfFilename: doc.file.name
            });
          }

          await supabase
            .from('driver_checkin_documents')
            .update({ processing_status: 'completed' })
            .eq('id', docRecord.id);

        } catch (processError) {
          console.error('Error processing document:', processError);

          await supabase
            .from('driver_checkin_documents')
            .update({
              processing_status: 'failed',
              error_message: processError instanceof Error ? processError.message : 'Unknown error'
            })
            .eq('id', docRecord.id);
        }
      }

      await supabase
        .from('driver_checkin_logs')
        .update({ status: 'completed' })
        .eq('id', checkinLogId);

      setStep('complete');
    } catch (err) {
      console.error('Error processing documents:', err);
      setError('Failed to process documents. Please contact support.');

      if (checkinLogId) {
        await supabase
          .from('driver_checkin_logs')
          .update({ status: 'failed' })
          .eq('id', checkinLogId);
      }
    } finally {
      setProcessing(false);
    }
  };


  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const startNewCheckin = () => {
    setStep('phone');
    setPhoneNumber('');
    setName('');
    setCompany('');
    setBolsCount(1);
    setDoorNumber('');
    setExistingDriver(false);
    setDriverCheckinId(null);
    setCheckinLogId(null);
    setScannedDocuments([]);
    setCurrentScanNumber(1);
    setError('');
  };

  const NumericKeypad = ({ onNumberClick, onBackspace, onClear }: {
    onNumberClick: (digit: string) => void;
    onBackspace: () => void;
    onClear: () => void;
  }) => (
    <div className="grid grid-cols-3 gap-3">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <button
          key={digit}
          onClick={() => onNumberClick(digit)}
          className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-2xl font-semibold py-6 rounded-lg transition-colors active:scale-95 transform"
          type="button"
        >
          {digit}
        </button>
      ))}
      <button
        onClick={onClear}
        className="bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 text-lg font-semibold py-6 rounded-lg transition-colors active:scale-95 transform flex items-center justify-center"
        type="button"
      >
        <X className="h-6 w-6" />
      </button>
      <button
        onClick={() => onNumberClick('0')}
        className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-2xl font-semibold py-6 rounded-lg transition-colors active:scale-95 transform"
        type="button"
      >
        0
      </button>
      <button
        onClick={onBackspace}
        className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-lg font-semibold py-6 rounded-lg transition-colors active:scale-95 transform flex items-center justify-center"
        type="button"
      >
        <Delete className="h-6 w-6" />
      </button>
    </div>
  );

  if (!settings?.isEnabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Driver Check-In Not Available</h2>
          <p className="text-gray-600 dark:text-gray-400">
            The driver check-in system is currently disabled. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 max-w-2xl w-full">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">Driver Check-In</h1>
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'phone' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
            }`}>1</div>
            <div className="w-8 h-1 bg-gray-300 dark:bg-gray-600"></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'info' || step === 'confirm' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
            }`}>2</div>
            <div className="w-8 h-1 bg-gray-300 dark:bg-gray-600"></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'scan' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
            }`}>3</div>
            <div className="w-8 h-1 bg-gray-300 dark:bg-gray-600"></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'complete' ? 'bg-green-600 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
            }`}>✓</div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {step === 'phone' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value);
                  setPhoneNumber(formatted);
                }}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg text-center"
                placeholder="111-111-1111"
                maxLength={12}
                autoFocus
              />
            </div>
            <NumericKeypad
              onNumberClick={handleKeypadNumber}
              onBackspace={handleKeypadBackspace}
              onClear={handleKeypadClear}
            />
            <button
              onClick={handlePhoneSubmit}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        )}

        {step === 'info' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                placeholder="Enter your name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                placeholder="Enter your company name"
              />
            </div>
            <button
              onClick={handleInfoSubmit}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Name:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Company:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{company}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of BOLs
              </label>
              <input
                type="number"
                min="1"
                value={bolsCount}
                onChange={(e) => setBolsCount(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Door Number (Optional)
              </label>
              <input
                type="number"
                min="1"
                value={doorNumber}
                onChange={(e) => setDoorNumber(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                placeholder="Enter door number"
              />
            </div>
            <button
              onClick={handleConfirmSubmit}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Start Scanning</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        )}

        {step === 'scan' && (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Scanning BOL {scannedDocuments.length + 1} of {bolsCount}
              </p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(scannedDocuments.length / bolsCount) * 100}%` }}
                ></div>
              </div>
            </div>

            {scannedDocuments.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {scannedDocuments.map((doc) => (
                  <div key={doc.order} className="relative aspect-square">
                    <img
                      src={doc.preview}
                      alt={`BOL ${doc.order}`}
                      className="w-full h-full object-cover rounded-lg border-2 border-green-500"
                    />
                    <button
                      onClick={() => removeDocument(doc.order)}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                      BOL {doc.order}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {scannedDocuments.length < bolsCount && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowScanner(true)}
                  className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Camera className="h-6 w-6" />
                  <span>Scan Document</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-gray-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Upload className="h-6 w-6" />
                  <span>Upload File</span>
                </button>
              </div>
            )}


            {scannedDocuments.length === bolsCount && (
              <button
                onClick={processDocuments}
                disabled={processing}
                className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-6 w-6" />
                    <span>Complete Check-In</span>
                  </>
                )}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center space-y-6">
            <CheckCircle className="h-24 w-24 text-green-600 mx-auto" />
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Check-In Complete!</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Thank you, {name}. Your {bolsCount} BOL document(s) have been processed.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
              {doorNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Door Number:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{doorNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Company:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{company}</span>
              </div>
            </div>
            <button
              onClick={startNewCheckin}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
            >
              Start New Check-In
            </button>
          </div>
        )}

        {showScanner && (
          <DocumentScanner
            onScanComplete={handleScanComplete}
            onCancel={handleScanCancel}
            documentName={`bol-${currentScanNumber}`}
          />
        )}
      </div>
    </div>
  );
}
