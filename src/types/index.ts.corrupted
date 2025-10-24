import React, { useState, useRef } from 'react';
import { Upload, FileText, Brain, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { detectExtractionType } from '../../lib/geminiDetector';
import type { ExtractionType, DetectionResult, VendorExtractionRule } from '../../types';
import { useAuth } from '../../hooks/useAuth';

interface AutoDetectPdfUploadSectionProps {
  extractionTypes: ExtractionType[];
  apiKey: string;
  onDetectionComplete: (
    uploadedFile: File, 
    pdfPages: File[], 
    detectedTypeId: string | null, 
    detectionResult: DetectionResult
  ) => void;
}

export default function AutoDetectPdfUploadSection({ 
  extractionTypes, 
  apiKey,
  onDetectionComplete 
}: AutoDetectPdfUploadSectionProps) {
  const { user } = useAuth();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [detectionError, setDetectionError] = useState<string>('');
  const [vendorRules, setVendorRules] = useState<VendorExtractionRule[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load vendor rules if user is a vendor
  React.useEffect(() => {
    const loadVendorRules = async () => {
      if (user?.role === 'vendor') {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          
          const response = await fetch(`${supabaseUrl}/rest/v1/vendor_extraction_rules?vendor_id=eq.${user.id}&is_enabled=eq.true&order=priority.asc`, {
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey
            }
          });

          if (response.ok) {
            const data = await response.json();
            const rules: VendorExtractionRule[] = data.map((rule: any) => ({
              id: rule.id,
              vendorId: rule.vendor_id,
              ruleName: rule.rule_name,
              autoDetectInstructions: rule.auto_detect_instructions,
              extractionTypeId: rule.extraction_type_id,
              transformationTypeId: rule.transformation_type_id,
              processingMode: rule.processing_mode,
              priority: rule.priority,
              isEnabled: rule.is_enabled,
              createdAt: rule.created_at,
              updatedAt: rule.updated_at
            }));
            
            setVendorRules(rules);
          }
        } catch (error) {
          console.error('Failed to load vendor rules:', error);
        }
      }
    };
    
    loadVendorRules();
  }, [user]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      handlePdfUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handlePdfUpload(files[0]);
    }
  };

  const handlePdfUpload = async (file: File) => {
    setUploadedFile(file);
    setIsProcessingPdf(true);
    setDetectionResult(null);
    setDetectionError('');

    try {
      // Split PDF into individual pages first
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();
      const pages: File[] = [];

      for (let i = 0; i < pageCount; i++) {
        // Create a new PDF document for this page
        const singlePageDoc = await PDFDocument.create();
        const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
        singlePageDoc.addPage(copiedPage);
        
        // Convert to bytes and create a File object
        const pdfBytes = await singlePageDoc.save();
        const pageFile = new File([pdfBytes], `${file.name.replace('.pdf', '')}_page_${i + 1}.pdf`, {
          type: 'application/pdf'
        });
        
        pages.push(pageFile);
      }

      setIsProcessingPdf(false);

      // Now start AI detection
      setIsDetecting(true);

      const result = await detectExtractionType({
        pdfFile: file,
        extractionTypes,
        vendorRules: user?.role === 'vendor' ? vendorRules : undefined,
        apiKey
      });

      setDetectionResult(result);
      setIsDetecting(false);

      // Notify parent component with the results
      onDetectionComplete(file, pages, result.detectedTypeId, result);

    } catch (error) {
      setIsProcessingPdf(false);
      setIsDetecting(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process PDF or detect extraction type';
      setDetectionError(errorMessage);
      console.error('Auto-detection error:', error);

      // Still notify parent with null detection if PDF processing succeeded
      if (!isProcessingPdf) {
        try {
          // Try to get pages even if detection failed
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pageCount = pdfDoc.getPageCount();
          const pages: File[] = [];

          for (let i = 0; i < pageCount; i++) {
            const singlePageDoc = await PDFDocument.create();
            const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
            singlePageDoc.addPage(copiedPage);
            
            const pdfBytes = await singlePageDoc.save();
            const pageFile = new File([pdfBytes], `${file.name.replace('.pdf', '')}_page_${i + 1}.pdf`, {
              type: 'application/pdf'
            });
            
            pages.push(pageFile);
          }

          onDetectionComplete(file, pages, null, {
            detectedTypeId: null,
            confidence: null,
            reasoning: errorMessage
          });
        } catch (pdfError) {
          // If even PDF processing fails, just notify with empty pages
          onDetectionComplete(file, [], null, {
            detectedTypeId: null,
            confidence: null,
            reasoning: errorMessage
          });
        }
      }
    }
  };

  const getDetectionStatusIcon = () => {
    if (isDetecting || isProcessingPdf) {
      return <Brain className="h-6 w-6 text-blue-600 animate-pulse" />;
    }
    
    if (detectionError) {
      return <XCircle className="h-6 w-6 text-red-600" />;
    }
    
    if (detectionResult) {
      if (detectionResult.detectedTypeId) {
        return detectionResult.confidence === 'high' 
          ? <CheckCircle className="h-6 w-6 text-green-600" />
          : <AlertTriangle className="h-6 w-6 text-yellow-600" />;
      } else {
        return <AlertTriangle className="h-6 w-6 text-orange-600" />;
      }
    }
    
    return <Brain className="h-6 w-6 text-purple-600" />;
  };

  const getDetectionStatusText = () => {
    if (isProcessingPdf) {
      return 'Processing PDF...';
    }
    
    if (isDetecting) {
      return 'AI is analyzing document...';
    }
    
    if (detectionError) {
      return `Detection failed: ${detectionError}`;
    }
    
    if (detectionResult) {
      if (detectionResult.detectedTypeId) {
        const detectedType = extractionTypes.find(type => type.id === detectionResult.detectedTypeId);
        if (detectionResult.isVendorRule && detectionResult.detectedRuleId) {
          const vendorRule = vendorRules.find(rule => rule.id === detectionResult.detectedRuleId);
          const ruleName = vendorRule?.ruleName || 'Unknown Rule';
          return `Detected: ${ruleName} (${detectionResult.confidence} confidence)`;
        } else {
          const typeName = detectedType?.name || 'Unknown Type';
          return `Detected: ${typeName} (${detectionResult.confidence} confidence)`;
        }
      } else {
        return 'Could not determine extraction type - please select manually';
      }
    }
    
    return 'Ready for AI-powered type detection';
  };

  const getStatusColor = () => {
    if (isDetecting || isProcessingPdf) {
      return 'text-blue-600';
    }
    
    if (detectionError) {
      return 'text-red-600';
    }
    
    if (detectionResult) {
      if (detectionResult.detectedTypeId) {
        return detectionResult.confidence === 'high' ? 'text-green-600' : 'text-yellow-600';
      } else {
        return 'text-orange-600';
      }
    }
    
    return 'text-purple-600';
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3">
        <div className="flex items-center space-x-2">
          <Brain className="h-4 w-4 text-purple-600" />
          <span>{user?.role === 'vendor' ? 'Upload PDF Document' : 'AI Auto-Detection Upload'}</span>
        </div>
      </label>
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-orange-400 bg-orange-50 dark:border-orange-500 dark:bg-orange-800/30'
            : uploadedFile
            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
            : 'border-orange-200 bg-orange-25 hover:border-orange-400 hover:bg-orange-50 dark:border-orange-600 dark:bg-orange-900/20 dark:hover:border-orange-500 dark:hover:bg-orange-800/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        {uploadedFile ? (
          <div className="space-y-3">
            <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto" />
            <p className="text-blue-700 dark:text-blue-300 font-medium text-sm">{uploadedFile.name}</p>
            <p className="text-xs text-blue-600">
              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            
            {/* Detection Status */}
            <div className="border-t border-blue-200 pt-3 mt-3">
              <div className="flex items-center justify-center space-x-2 mb-2">
                {getDetectionStatusIcon()}
                <span className={`text-sm font-medium ${getStatusColor()}`}>
                  AI Detection Status
                </span>
              </div>
              <p className={`text-xs ${getStatusColor()}`}>
                {getDetectionStatusText()}
              </p>
              
              {detectionResult?.reasoning && (
                <div className="mt-2 bg-white/50 dark:bg-gray-800/50 rounded-lg p-2 border border-blue-200 dark:border-blue-600">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>AI Reasoning:</strong> {detectionResult.reasoning}
                  </p>
                  {detectionResult.isVendorRule && (
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      <strong>Matched Vendor Rule:</strong> This document matched your specific processing rules
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <Upload className="h-8 w-8 text-orange-400" />
              <Brain className="h-6 w-6 text-orange-500" />
            </div>
            <p className="text-orange-600 font-medium text-sm">AI-Powered Type Detection</p>
            <p className="text-xs text-orange-500">Upload PDF to automatically detect extraction type</p>
          </div>
        )}
      </div>
      
      {/* Information about auto-detection */}
      {user?.role !== 'vendor' && (
        <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Brain className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-300">How Auto-Detection Works</span>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            The AI analyzes your PDF's content and structure to automatically suggest the best extraction type. 
            If detection fails or confidence is low, you can still manually select the type.
          </p>
        </div>
      )}
      
    </div>
  );
}