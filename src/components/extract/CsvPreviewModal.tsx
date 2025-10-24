import React from 'react';
import { Copy, Download, X } from 'lucide-react';
import Modal from '../common/Modal';

interface CsvPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  csvContent: string;
  delimiter?: string;
  hasHeaders?: boolean;
  pageTitle: string;
}

export default function CsvPreviewModal({
  isOpen,
  onClose,
  csvContent,
  delimiter = ',',
  hasHeaders = true,
  pageTitle
}: CsvPreviewModalProps) {
  const parsedData = parseCsvContent(csvContent, delimiter);
  const headers = hasHeaders && parsedData.length > 0 ? parsedData[0] : null;
  const rows = hasHeaders ? parsedData.slice(1) : parsedData;
  const columnCount = parsedData.length > 0 ? parsedData[0].length : 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(csvContent);
    } catch (error) {
      console.error('Failed to copy CSV content:', error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `csv-preview-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={pageTitle}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold">{rows.length}</span> row{rows.length !== 1 ? 's' : ''} × {' '}
            <span className="font-semibold">{columnCount}</span> column{columnCount !== 1 ? 's' : ''}
            {hasHeaders && headers && ' (with headers)'}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
              title="Copy CSV to clipboard"
            >
              <Copy className="h-4 w-4" />
              <span>Copy</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
              title="Download CSV file"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
          </div>
        </div>

        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
          <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
            <table className="w-full border-collapse">
              {hasHeaders && headers && (
                <thead className="sticky top-0 bg-blue-50 dark:bg-blue-900/30 z-10">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-b border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 sticky left-0 z-20 min-w-[60px]">
                      #
                    </th>
                    {headers.map((header, colIndex) => (
                      <th
                        key={colIndex}
                        className="px-3 py-2 text-left text-sm font-semibold text-blue-900 dark:text-blue-200 border-r border-b border-gray-300 dark:border-gray-600 whitespace-nowrap min-w-[120px]"
                      >
                        {header || <span className="text-gray-400 italic">Empty</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columnCount + 1}
                      className="px-3 py-8 text-center text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600"
                    >
                      No data rows found
                    </td>
                  </tr>
                ) : (
                  rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}
                    >
                      <td className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-r border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 sticky left-0 min-w-[60px]">
                        {rowIndex + 1}
                      </td>
                      {row.map((cell, colIndex) => (
                        <td
                          key={colIndex}
                          className="px-3 py-2 text-sm text-gray-800 dark:text-gray-200 border-r border-b border-gray-300 dark:border-gray-600 whitespace-nowrap min-w-[120px]"
                        >
                          {cell || <span className="text-gray-400 dark:text-gray-500 italic text-xs">empty</span>}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Scroll horizontally and vertically to view all data
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <X className="h-4 w-4" />
            <span>Close</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

function parseCsvContent(content: string, delimiter: string = ','): string[][] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const result: string[][] = [];

  for (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }

    const row: string[] = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = i < line.length - 1 ? line[i + 1] : null;

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        row.push(currentCell);
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    row.push(currentCell);
    result.push(row);
  }

  return result;
}
