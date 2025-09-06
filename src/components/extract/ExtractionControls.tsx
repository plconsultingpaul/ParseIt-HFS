import React from 'react';
import type { ExtractionType } from '../../types';

interface ExtractionControlsProps {
  extractionTypes: ExtractionType[];
  selectedExtractionType: string;
  additionalInstructions: string;
  onSelectExtractionType: (typeId: string) => void;
  onUpdateAdditionalInstructions: (instructions: string) => void;
}

export default function ExtractionControls({
  extractionTypes,
  selectedExtractionType,
  additionalInstructions,
  onSelectExtractionType,
  onUpdateAdditionalInstructions
}: ExtractionControlsProps) {
  const currentExtractionType = extractionTypes.find(type => type.id === selectedExtractionType);

  return (
    <div className="space-y-6">
      {/* Extraction Type */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Extraction Type
        </label>
        <select
          value={selectedExtractionType}
          onChange={(e) => onSelectExtractionType(e.target.value)}
          className="w-full px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
        >
          {extractionTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      {/* Default Extraction Instructions */}
      {currentExtractionType && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Default Extraction Instructions
          </label>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <p className="text-purple-800 text-sm leading-relaxed whitespace-pre-wrap">
              {currentExtractionType.defaultInstructions}
            </p>
          </div>
        </div>
      )}

      {/* Additional Instructions */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Additional Instructions (Optional)
        </label>
        <textarea
          value={additionalInstructions}
          onChange={(e) => onUpdateAdditionalInstructions(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
          rows={3}
          placeholder="Add any specific instructions for this extraction..."
        />
        <p className="text-sm text-gray-500 mt-2">
          These instructions will be added to the default ones above.
        </p>
      </div>
    </div>
  );
}