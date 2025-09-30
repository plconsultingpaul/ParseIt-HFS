import React, { useState, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface PdfUploadSectionProps {
  onPdfUpload: (uploadedFile: File, pdfPages: File[]) => void;
}

export default function PdfUploadSection({ onPdfUpload }: PdfUploadSectionProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pdfPages, setPdfPages] = useState<File[]>([]);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setPdfPages([]);

    try {
      // Split PDF into individual pages
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
      
      setPdfPages(pages);
      onPdfUpload(file, pages);
    } catch (error) {
      console.error('Error splitting PDF:', error);
      // Still call onPdfUpload with empty pages array to let parent handle the error
      onPdfUpload(file, []);
    } finally {
      setIsProcessingPdf(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3">
        <span className="text-gray-700 dark:text-gray-200">PDF Document</span>
      </label>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-purple-400 bg-purple-50'
            : uploadedFile
            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
            : 'border-purple-200 bg-purple-25 hover:border-purple-400 hover:bg-purple-50 dark:border-purple-600 dark:bg-purple-900/20 dark:hover:border-purple-500 dark:hover:bg-purple-800/30'
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
          <div className="space-y-2">
            <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto" />
            <p className="text-blue-700 dark:text-blue-300 font-medium text-sm">{uploadedFile.name}</p>
            <p className="text-xs text-green-600">
              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
              {pdfPages.length > 0 && ` • ${pdfPages.length} page${pdfPages.length !== 1 ? 's' : ''}`}
              {isProcessingPdf && ' • Processing...'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 text-purple-400 mx-auto" />
            <p className="text-purple-600 font-medium text-sm">Click to upload or drag & drop</p>
            <p className="text-xs text-purple-500">PDF only (max 5MB)</p>
          </div>
        )}
      </div>
    </div>
  );
}